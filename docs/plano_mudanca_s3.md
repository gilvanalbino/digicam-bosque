# Plano: mover fotos antigas para o S3 depois de 1 semana

Levantamento feito em 2026-11-19 na máquina `serverbosque` (10.0.0.126). Nada deste plano foi executado.

## 1. Objetivo

As fotos de produção (`/digicam-fotos`) ocupam 32 GB e crescem ~630 MB por dia. Em 19/11 o disco chegou a 96% e
só voltou a 73% com limpeza manual de HML, FTP e log; em 13/11 a produção já tinha caído por disco cheio. O objetivo
é manter no disco local só os últimos 7 dias de fotos e guardar o resto no S3, sem perder nenhuma foto e sem mudar
o que o operador vê nas telas.

Fora do escopo: as fotos do FTP das câmeras (`/home/digicamftp/ftp/fotos`) e as do HML, que só precisam de limpeza
(seção 9), e as imagens em base64 da `LogIdentificacao`, que ficam no banco e são removidas no processamento.

## 2. Situação atual

### 2.1 Volume (média de 12 a 18/11, sem o dia 13, de queda)

| Medida | Valor |
|---|---|
| Fotos novas por dia | ~7.300 arquivos, ~630 MB |
| Por mês | ~220 mil arquivos, ~19 GB |
| Arquivos com menos de 128 KB (miniaturas e recortes de placa) | 2/3 do total |
| Acumulado em `/digicam-fotos` (desde 25/09/2025) | 397 mil arquivos, 32 GB |
| Registros de `Trafegos` com foto | 263 mil |

O volume acompanha o tráfego de hoje (700 a 900 veículos por dia). Cada passagem gera até 6 arquivos: foto, miniatura
e recorte da placa, na entrada e na saída.

### 2.2 Onde as fotos são referenciadas

Gravação: `backend/services/file.service.js` (`saveFile`, base `/digicam-fotos/`), chamada por
`salvarImagensLogIdentificacao` em `backend/controllers/logIdentificacao.controller.js`. Pasta `/<ano>/<mês>/<dia>`
do dia da gravação, sem zero à esquerda (`/2026/11/7/...`).

O banco guarda o caminho relativo:

| Tabela | Colunas |
|---|---|
| `Trafegos` | `imagem`, `imagem_thumb`, `imagem_placa`, `imagem_saida`, `imagem_saida_thumb`, `imagem_saida_placa` |
| `Saidas_nao_identificadas` | `imagem_carro`, `imagem_carro_thumb`, `imagem_placa` |

Exemplo: `/2026/11/19/KZK5643-18-43-21.jpg`, `..._thumb.jpg`, `...-placa.jpg`.

Exibição: o frontend monta `/images${caminho}` em 9 arquivos (`TrafegoCard.vue`, `ListaTrafego.vue`,
`ListTrafegos.vue`, `FormTrafego.vue`, `HistoricoSaidas.vue`, `LinhaDoTempo.vue`, `PainelSaidas.vue`,
`DetalheAnomalia.vue`, `relatorios/ListagemTrafegoPorPeriodo.vue`). O nginx de produção serve `/images` direto do
disco (`location /images` em `/home/digicam/nginx.conf`), **sem exigir login**. Relatórios em Excel/PDF não embutem
fotos.

## 3. Solução

Um serviço dedicado, **`arquivar-fotos`**, roda uma vez por noite e, para cada dia com mais de 7 dias:

1. envia ao S3 todos os arquivos da pasta do dia;
2. confere cada envio (tamanho e MD5 pelo ETag);
3. troca, no banco, o caminho de cada foto enviada pelo mesmo caminho com o prefixo `/s3`
   (`/2026/11/7/X.jpg` → `/s3/2026/11/7/X.jpg`);
4. só depois apaga o arquivo local.

Com o prefixo, o frontend continua montando `/images${caminho}`, que vira `/images/s3/2026/11/7/X.jpg`. O nginx
repassa esse caminho ao backend, que responde com um redirecionamento para um link temporário do S3. **Nenhuma tela
do frontend muda.**

```
navegador ──/images/2026/11/19/X.jpg──────► nginx ──► disco local (até 7 dias)
navegador ──/images/s3/2026/11/7/X.jpg────► nginx ──► backend /digicam/imagens/s3/... ──302──► S3 (link de 5 min)
```

### 3.1 Por que um serviço próprio

- não pesa no backend, que atende as câmeras e as telas: o envio de ~630 MB/noite roda em processo separado, com
  limite de CPU e de banda;
- pode parar, falhar e repetir sem afetar a operação: cada passo é idempotente (seção 4.3);
- segue o padrão do `anomalias` e do `verificar-novas-placas`: mesma rede, mesmo banco, container próprio.

## 4. Serviço `arquivar-fotos`

### 4.1 Tecnologia e lugar

- Node.js 18, como o backend, com `mysql2` e `@aws-sdk/client-s3` (v3). Pasta `arquivar-fotos/` na raiz do
  repositório, com Dockerfile próprio.
- Container no compose de produção e no de HML, com o volume das fotos (`/digicam-fotos`) e acesso ao MySQL.
- Agendamento interno (`node-cron`), às 02:00 (America/Bahia), fora do horário de pico e da hora cheia em que o
  `reiniciar.sh` derruba e sobe o compose. A execução é retomável: se for interrompida, a próxima continua.

### 4.2 Fluxo por dia arquivado

```
para cada pasta /digicam-fotos/<ano>/<mês>/<dia> com data < hoje - 7 dias:
  para cada arquivo (em lotes de 200):
    chave = "<prefixo>/<ano>/<mês>/<dia>/<nome>"      (prefixo: "producao" ou "hml")
    se HeadObject(chave) já existe com o mesmo tamanho e MD5 → pula o envio
    senão PutObject(chave, Content-Type image/jpeg, ContentMD5) → confere o ETag
  atualiza o banco do dia (4.4), em transação
  confere que nenhuma linha do banco aponta mais para o caminho local dessas fotos
  apaga os arquivos locais enviados e a pasta, se ficar vazia
  grava o resumo da execução (4.6)
```

Arquivos da pasta sem referência no banco (por exemplo, fotos de leituras descartadas) também são enviados, para
nada se perder; ficam no S3 sem link nas telas.

### 4.3 Garantias

- **Nada é apagado antes de estar no S3 e no banco.** Ordem fixa: envia → confere → atualiza banco → apaga local.
- **Idempotente.** Reenviar um arquivo que já está no S3 é pulado pelo HeadObject; atualizar o banco de novo não muda
  nada (o `WHERE` só pega caminhos sem `/s3`); apagar um arquivo que já não existe é ignorado.
- **Falha no meio.** Se o envio falha, o dia fica para a próxima noite, sem mexer no banco. Se a atualização do
  banco falha, a transação é desfeita e os arquivos locais continuam. Se o processo morre depois do banco e antes de
  apagar, a próxima execução só apaga.
- **Modo cópia.** Variável `APAGAR_LOCAL=false` (padrão na primeira fase): envia e atualiza o banco, mas não apaga o
  local. Permite validar por semanas antes de liberar espaço.

### 4.4 Atualização do banco

Por dia arquivado, em uma transação, para cada coluna da seção 2.2:

```sql
UPDATE Trafegos SET imagem = CONCAT('/s3', imagem)
 WHERE imagem LIKE '/2026/11/7/%';
-- idem para as outras 5 colunas de Trafegos e as 3 de Saidas_nao_identificadas
```

- Só são trocados os caminhos cujos arquivos foram enviados e conferidos no passo anterior; caminho que aponta para
  arquivo inexistente no disco fica como está e entra no resumo.
- O `LIKE` com prefixo fixo varre a tabela (as colunas não têm índice); com ~263 mil linhas leva menos de 1 s por
  coluna. Se crescer muito, criar índice nas colunas `imagem` e `imagem_saida`.
- O backend passa a gravar fotos novas sem `/s3`, como hoje; nada muda na gravação.

### 4.5 Bucket S3

- Bucket privado em `us-east-2` (Ohio, mesma região da instância do nginx público), com Block Public Access ligado,
  criptografia SSE-S3 e sem versionamento.
- Prefixos `producao/` e `hml/`, para o HML testar sem tocar nas fotos de produção.
- Usuário IAM `digicam-arquivar-fotos` com acesso só a esse bucket: `s3:PutObject`, `s3:GetObject`,
  `s3:HeadObject` (via `GetObject`) e `s3:ListBucket`, sem `DeleteObject`. Chaves no `.env` do servidor
  (`S3_BUCKET`, `S3_REGIAO`, `S3_CHAVE`, `S3_SEGREDO`), nunca no repositório.
- Regra de ciclo de vida opcional (decisão da seção 10): apagar depois de N anos e/ou mover para Glacier Instant
  Retrieval, depois de 90 dias, só os arquivos acima de 128 KB.

### 4.6 Registro e monitoramento

- Tabela nova `Arquivamento_fotos` (migração manual em produção): uma linha por dia arquivado, com data da pasta,
  arquivos enviados, já existentes, sem referência no banco e com erro, bytes enviados, linhas atualizadas por
  tabela, início, fim e situação (`copiado`, `concluido`, `erro`).
- Log em uma linha por dia processado, no formato do `anomalias`, para busca com `grep` (e no Loki, se o plano de
  observabilidade for executado).
- Alerta simples: se nenhum dia for concluído em 3 noites seguidas, o resumo marca `atrasado`, e o painel de
  anomalias ou o Grafana mostram.

## 5. Leitura das fotos no S3

### 5.1 Backend

Rota nova `GET /digicam/imagens/s3/{caminho*}`:

- valida o caminho (só `<ano>/<mês>/<dia>/<nome>.jpg`, sem `..`);
- gera um link temporário de leitura do S3 (5 minutos) e responde `302` para ele, com `Cache-Control: private,
  max-age=240`;
- usa as mesmas chaves do serviço, com uso só de `GetObject` (ou um usuário IAM separado, só leitura).

### 5.2 nginx (produção e HML)

```nginx
location /images/s3/ {
    rewrite ^/images/s3/(.*)$ /digicam/imagens/s3/$1 break;
    proxy_pass http://$backend_upstream;
}
```

O bloco fica antes de `location /images`. Hoje `/images` é público. Para não piorar nem mudar o comportamento, a rota
do S3 também não exige login nesta etapa; exigir login para todas as fotos é recomendado, mas é outro trabalho
(as tags `<img>` não mandam o cabeçalho `Authorization`, seria preciso cookie ou token na URL).

## 6. Custo estimado

Preços de tabela do S3 em `us-east-2`: Standard US$ 0,023/GB-mês, envio US$ 0,005 por mil, leitura US$ 0,0004 por
mil, entrada de dados grátis. Conferir na calculadora da AWS antes de aprovar.

| Item | Por mês | 1º ano |
|---|---|---|
| Envio das fotos novas (220 mil arquivos) | US$ 1,10 | US$ 13 |
| Armazenamento (32 GB atuais + 19 GB/mês) | US$ 1,20 → 6,00 | US$ 43 |
| Envio do acumulado atual (uma vez) | — | US$ 2 |
| Leitura e transferência das fotos antigas vistas nas telas | < US$ 0,10 | < US$ 1 |
| **Total** | | **~US$ 58** |

Sem prazo de exclusão, o 2º ano fica em ~US$ 115. Com exclusão depois de 1 ano, estabiliza em ~US$ 6 a 7 por mês.
Standard-IA e Glacier IR não compensam para tudo: cobram no mínimo 128 KB por arquivo e 2/3 dos arquivos são
menores, o que praticamente dobra o volume cobrado; além disso o envio custa 2 a 4 vezes mais.

Banda de saída do condomínio: ~630 MB por noite (~1,5 Mbps durante 1 hora). O acumulado de 32 GB é enviado aos
poucos (seção 7, fase 5).

## 7. Fases

| Fase | O que | Onde | Critério para seguir |
|---|---|---|---|
| 0 | Criar bucket, usuário IAM e chaves; decidir retenção (seção 10) | AWS | bucket privado acessível do servidor |
| 1 | Serviço `arquivar-fotos`, rota do backend e bloco do nginx; testes unitários (caminho, idempotência, falha no meio) | código | testes passam |
| 2 | HML com prefixo `hml/`, modo cópia, depois com `APAGAR_LOCAL=true` | HML | telas do HML mostram as fotos antigas pelo S3; contagem local + S3 = original |
| 3 | Produção em modo cópia (envia e troca o banco, não apaga), 2 semanas | produção | nenhuma foto quebrada nas telas; resumo sem erros |
| 4 | Produção com `APAGAR_LOCAL=true` | produção | disco estabiliza em ~7 dias de fotos (~4,5 GB) |
| 5 | Acumulado desde 25/09/2025, ~3 GB por noite | produção | `/digicam-fotos` só com os últimos 7 dias |

Produção: editar `/home/digicam/docker-compose.yml` e `nginx.conf` e migrar o banco só com autorização explícita,
com cópia antes (`*.antes-<versão>-<data>`) e dump em `/home/digicam/hml/dump/`, conforme as regras de produção.

## 8. Retorno (rollback)

- **Antes da fase 4** (local ainda existe): remover o prefixo no banco
  (`UPDATE ... SET imagem = SUBSTRING(imagem, 4) WHERE imagem LIKE '/s3/%'`, por coluna) e desligar o serviço.
- **Depois da fase 4**: o serviço tem o modo `restaurar <data inicial> <data final>`, que baixa os arquivos do S3 para
  `/digicam-fotos`, confere e só então tira o prefixo no banco. Os arquivos continuam no S3 (o usuário não tem
  `DeleteObject`).
- O S3 fora do ar só afeta as fotos com mais de 7 dias; as telas do dia a dia usam as fotos locais.

## 9. Fora do S3: limpeza automática do FTP e do HML

Em 19/11 foram apagados à mão 8,4 GB do HML e 9,8 GB do FTP. Essas pastas não precisam ir para o S3:

- FTP das câmeras (`/home/digicamftp/ftp/fotos`, ~0,65 GB/dia): o backend só lê na hora da leitura da placa
  (`ftpService` em `logIdentificacao.controller.js`). Apagar pastas com mais de 7 dias.
- Fotos do HML (`/home/digicam/hml/fotos`, ~0,5 GB/dia): dado de teste. Apagar com mais de 7 dias, ou usar o próprio
  `arquivar-fotos` com prefixo `hml/` na fase 2.

Pode ser um cron diário no servidor, independente deste plano, e já reduz o crescimento do disco de ~1,7 GB/dia para
~0,6 GB/dia.

## 10. Decisões pendentes

1. **Retenção no S3:** guardar para sempre, 1 ano, 2 anos? Define o custo a partir do 2º ano e a regra de ciclo de
   vida.
2. **Conta e região da AWS:** usar a mesma conta da instância do nginx público (`us-east-2`)?
3. **Fotos do HML no S3** (prefixo `hml/`) ou só limpeza local?
4. **Exigir login nas fotos** (`/images` e `/images/s3`): hoje qualquer um que saiba o caminho vê a foto.
5. **Prazo local:** 7 dias é suficiente para conciliação e anomalias? (As saídas sem entrada e o detector de
   anomalias trabalham com até 72 h.)
