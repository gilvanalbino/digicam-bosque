# Plano: identificação de entradas e saídas por software, integrada ao sistema

Levantamento feito em 2026-11-19 com base no protótipo `visao-placas/` (commit `a62cee2`), que roda no HML na
Entrada B2 desde 16/11. Nada deste plano foi executado.

## 1. Objetivo

Usar a identificação por vídeo como segunda fonte de leitura, ao lado da câmera:

- registrar entradas e saídas que a câmera não detectou;
- corrigir placas que a câmera leu errado;
- guardar, para cada passagem, **quem identificou** (só câmera, só software ou os dois) e **o texto lido por cada
  um**;
- ligar ou desligar o recurso **por câmera, no cadastro da câmera**;
- na divergência, **valer a placa do software quando o recurso estiver ligado** na câmera.

### 1.1 Por que vale a pena (protótipo na Entrada B2, 16/11 19:28 a 19/11 18:28, comparado com produção)

| Medida | Resultado |
|---|---|
| Entradas registradas pela câmera | 420 |
| Entradas vistas pelo software | 1.156 |
| Só o software viu, com placa | 515, das quais **404 saíram depois como "saída sem entrada"** |
| Os dois viram | 359; em 92 as placas divergem e o software acerta quase sempre (amostra: 15 de 16) |
| Só a câmera viu | 61 (15%) |
| Placa lida pelo software (carros) | 92% de dia, 92% à noite |
| Motos | 240 vistas, nenhuma com placa (a B2 vê o veículo de frente; moto só tem placa traseira) |
| Recursos | ~1 CPU e ~380 MB por câmera |

Erro típico da câmera: lê a letra da placa Mercosul como número (`KRU2B11` → `KRU2811`, `LUE2D69` → `LUE2069`).

## 2. Situação atual

### 2.1 Fluxo da câmera

1. `verificar-novas-placas` consulta as câmeras a cada 5 s e envia cada leitura para
   `POST /digicam/logIdentificacao` (login próprio no backend, `src/services/digicam-backend.service.js`).
2. `insertLogIdentificacao` (`backend/controllers/logIdentificacao.controller.js`): descarta leitura repetida e no
   sentido contrário, corrige pela green list, grava a `LogIdentificacao` e baixa as fotos.
3. Câmera de entrada: depois das fotos, cria o `Trafego` (entrada automática).
   Câmera de saída: `tentarRegistrarSaidaAutomatica` procura a entrada pela placa exata e depois pela placa
   próxima (1 caractere, `obterEntradaPorPlacaProxima`); sem entrada, a leitura vira `Saidas_nao_identificadas`.

### 2.2 Protótipo `visao-placas`

Um container por câmera, com configuração em arquivo (`config.yaml`: linha virtual, área, limiares). Grava as
passagens em SQLite próprio e compara com `Trafegos` só para estatística; não interfere no sistema. Detalhes no
`homologacao/README.md`.

### 2.3 Cadastro da câmera

`Cameras`: `nome`, `url`, `modelo`, `sentido` (E/S), `posicionamento` (F/T), `client_id`, `portaria_id`, `login`,
`senha` (`backend/models/camera.js`, `backend/routes/schemas.js`, `frontend/src/pages/cameras/FormCamera.vue`).

## 3. Visão geral da solução

```
             câmera Hikvision                        vídeo RTSP (canal 101)
                   │                                          │
        verificar-novas-placas                     identificacao-software (visao-placas)
                   │ POST /logIdentificacao                   │ POST /identificacoesSoftware/...
                   ▼                                          ▼
                 backend ──► CONCILIADOR (novo) ──► uma linha em Identificacoes por passagem
                                    │                  (placa da câmera, placa do software, origem, decisão)
                                    ▼
                    fluxo atual de entrada/saída (Trafego, saída automática, saída sem entrada)
                    com a PLACA FINAL decidida pelo conciliador
```

Princípios:

- **Uma passagem, um registro.** Cada veículo que passa por uma câmera gera uma linha em `Identificacoes`, que junta a
  leitura da câmera e a do software, quando houver.
- **O fluxo de entrada e saída de hoje continua o mesmo.** Ele só passa a receber a placa final decidida pelo
  conciliador, em vez da placa da câmera.
- **O software fora do ar não para nada.** Sem a leitura do software, o sistema funciona como hoje, só com a câmera.

## 4. Cadastro da câmera

Campo novo `identificacao_software` (booleano, padrão **desligado**), na tela um interruptor "Identificação por
software: Desligada / Ligada" (decidido em 19/11: só dois estados, para manter simples):

| Valor | O software roda? | Placa usada no tráfego | Cria entrada/saída só com o software? | Registro em `Identificacoes` |
|---|---|---|---|---|
| **Desligada** (padrão) | não; o vídeo da câmera não é processado, sem custo de CPU | câmera | não | sim, só com a leitura da câmera (`origem = camera`) |
| **Ligada** | sim | **software** na divergência | **sim** | sim, com as duas leituras |

Como as duas leituras ficam sempre guardadas no mesmo registro, a avaliação de uma câmera recém-ligada é feita pelos
próprios dados (relatório da seção 8): quantas passagens só o software viu, divergências e quem acertou. Se a câmera
não se comportar bem, basta desligar no cadastro; o efeito é imediato (seção 6).

Campo novo `config_software` (JSON) com a configuração de vídeo da câmera, hoje no `config.yaml` do protótipo:

```json
{ "canal": 101, "qps": 5,
  "linha": { "p1": [0, 150], "p2": [1100, 1080], "ponto_dentro": [100, 900], "ancora": "centro", "margem": 15 },
  "area": [[0,0],[1920,0],[1920,760],[1680,760],[1680,1080],[0,1080]],
  "detector": { "confianca": 0.25 } }
```

O `config_software` **não é digitado**: a linha virtual e a área são **desenhadas sobre a foto da câmera**, no
próprio formulário (decidido em 19/11), só por administrador:

1. O formulário mostra uma foto atual da câmera em resolução cheia, buscada pelo backend
   (`GET /digicam/cameras/{id}/foto`, que repassa `/ISAPI/Streaming/channels/101/picture` com a autenticação digest
   da câmera, como o backend já faz para as fotos de placa). Botão "Atualizar foto".
2. Sobre a foto, num `<canvas>`:
   - o administrador clica nos **dois pontos da linha virtual**;
   - clica num ponto **do lado de dentro do condomínio** (a tela pinta os dois lados de cores diferentes, com uma seta
     "entrada", para conferir);
   - opcionalmente, desenha a **área de interesse** como polígono (clique a clique, duplo clique fecha), para ignorar
     regiões com detecção falsa, como a caixa da outra cancela na B2.
3. As coordenadas são salvas em pixels da imagem original (1920x1080), não da tela, para valerem em qualquer
   tamanho de monitor. O backend valida: pontos dentro da imagem, linha com tamanho mínimo, ponto de dentro fora da
   margem da linha, polígono com pelo menos 3 pontos.
4. Opcional, para conferir antes de salvar: "Testar nas últimas passagens" mostra as últimas fotos do software
   dessa câmera com a linha desenhada por cima.

Os parâmetros técnicos (`qps`, `margem`, `ancora`, `detector.confianca`) ficam com valores padrão e só aparecem num
bloco "avançado" recolhido.

## 5. Banco de dados

### 5.1 Tabela nova `Identificacoes`

Uma linha por veículo que passa por uma câmera.

| Coluna | Tipo | Conteúdo |
|---|---|---|
| `id` | int PK | |
| `client_id`, `camera_id` | int, índices | |
| `sentido` | char(1) | E/S, da câmera |
| `origem` | enum `camera`, `software`, `ambos` | quem identificou |
| `placa_camera` | varchar(10), null | texto lido pela câmera (antes da correção pela green list) |
| `placa_software` | varchar(10), null | texto lido pelo software |
| `confianca_software` | decimal(4,3), null | média das leituras escolhidas |
| `leituras_software` | int, null | quadros que votaram na placa escolhida |
| `classe_veiculo` | varchar(12), null | carro, moto, caminhão, ônibus (software) |
| `placa_operador` | varchar(10), null | placa digitada ou escolhida pelo operador, quando ele editou |
| `placa_final` | varchar(10), null | placa usada no tráfego (null: sem placa) |
| `fonte_placa_final` | enum `camera`, `software`, `green_list`, `operador` | de onde veio a placa final |
| `divergente` | bool | os dois leram e as placas diferem |
| `software_ligado` | bool | valor do cadastro da câmera no momento da decisão |
| `instante_camera` | datetime(3), null | captura da câmera |
| `instante_software_inicio` | datetime(3), null | veículo apareceu no vídeo |
| `instante_software` | datetime(3), null | veículo cruzou a linha |
| `identificador_placa` | varchar(255), null, índice | o mesmo da `LogIdentificacao` (liga às fotos da câmera) |
| `rastro_software` | varchar(64), null, único | id da passagem no software (idempotência) |
| `foto_software`, `foto_software_placa` | varchar(255), null | caminhos em `/digicam-fotos` |
| `trafego_id` | int, null, índice | entrada ou saída registrada |
| `saida_nao_identificada_id` | int, null | quando a saída ficou sem entrada |
| `situacao` | enum `aguardando`, `concluida`, `descartada` | `descartada`: manobra, sentido contrário |
| `historico` | JSON, null | toda troca de placa (automática ou do operador) e toda leitura não aplicada: placa anterior, nova, fonte, usuário e instante (7.4) |
| `createdAt`, `updatedAt` | | |

Índice composto `(camera_id, instante_camera)` e `(camera_id, instante_software_inicio)` para o casamento.

### 5.2 Colunas novas em tabelas existentes

- `Cameras`: `identificacao_software` (booleano, padrão `false`), `config_software` (JSON, null).
- `Trafegos`: `identificacao_entrada_id`, `identificacao_saida_id` (int, null), para as telas mostrarem a origem e as
  duas placas sem `JOIN` pesado.
- `Saidas_nao_identificadas`: `identificacao_id` (int, null).

Uma migração Sequelize. Em produção a migração é manual, com dump antes (regras de produção).

## 6. Serviço `identificacao-software`

Evolução do `visao-placas`, com o mesmo núcleo (detector YOLOX-tiny, rastreamento, linha virtual, fast-alpr, votação):

- **Configuração vinda do sistema:** ao iniciar e a cada 60 s, o serviço lê as câmeras com
  `identificacao_software` ligado e o `config_software` de cada uma (rota
  `GET /digicam/cameras/software`). Com isso, liga e desliga uma câmera sem reiniciar o serviço. Usa o mesmo
  esquema de login do `verificar-novas-placas`.
- **Uma linha de execução por câmera:** cada uma lê o RTSP, decodifica e analisa, tudo isolado. Se uma câmera
  falha, as outras continuam. Uma câmera usa ~1 CPU (a decodificação de 1080p é a maior parte do custo), então 4
  câmeras usam ~4 dos 12 núcleos. O limite do container fica em 5 CPUs.
- **Dois eventos por veículo**, enviados ao backend:
  1. **`leitura`** — assim que a votação da placa fica estável (≥ 3 leituras iguais), ainda **antes** de o veículo
     cruzar a linha: `POST /digicam/identificacoesSoftware/leitura` com `rastro`, câmera, `inicio`, placa,
     confiança, classe e a foto (base64, como a câmera). Esse evento chega mais ou menos junto com a leitura da
     câmera, que também lê o veículo na chegada.
  2. **`passagem`** — quando o veículo cruza a linha (ou some sem cruzar):
     `POST /digicam/identificacoesSoftware/passagem` com `rastro`, direção (`entrada`, `saida` ou `nenhuma` para
     manobra), instante, placa final da votação e classe.
- **Fila local e repetição:** se o backend estiver fora do ar, os eventos vão para um SQLite local e são reenviados.
  `rastro` torna os envios idempotentes.
- **Fotos:** enviadas junto com o evento; o backend grava em `/digicam-fotos` com a mesma rotina das fotos da câmera
  (`file.service.js`). Isso mantém um único dono da pasta, compatível com `docs/plano_mudanca_s3.md`.
- A página `/visao/` do protótipo é substituída pelas telas do sistema (seção 8).

## 7. Conciliador (backend)

Módulo novo `backend/services/conciliadorIdentificacao.service.js`, chamado pelas duas entradas: leitura da câmera
(`insertLogIdentificacao`) e eventos do software.

### 7.1 Casamento

Uma leitura da câmera e uma do software são a mesma passagem quando:

- são da mesma câmera;
- o `instante_camera` está entre `instante_software_inicio − 20 s` e `instante_software + 20 s` (a câmera lê na
  chegada; o veículo pode ficar parado na cancela antes de cruzar);
- havendo mais de uma candidata, vale a placa mais parecida (`diferencasPlacas`, `backend/services/placaUtil.js`)
  e depois o horário mais próximo — a mesma regra validada no protótipo (`visao-placas/src/visao/comparacao.py`).

### 7.2 Decisão da placa final

Com a câmera **desligada** não há leitura do software: vale a da câmera, como hoje. Com ela **ligada**:

| Situação | Placa final |
|---|---|
| Só câmera (o software não viu) | câmera |
| Os dois, mesma placa | a mesma |
| Os dois, placas diferentes | **software**, `divergente = true` |
| Só software, com placa | **software** (cria a entrada ou registra a saída) |
| Só software, sem placa | nada no tráfego, só o registro (7.5, backlog) |

Regras gerais:

- A placa que está na **red list** nunca é substituída. Se a câmera leu uma placa da red list e o software leu
  outra, vale a da câmera e a divergência fica marcada para revisão.
- A correção pela **green list** (1 caractere de diferença, `obterPlacaCorrigida`) é aplicada sobre a placa final,
  como hoje; `fonte_placa_final = green_list` quando muda o texto.
- O texto original de cada solução fica sempre em `placa_camera` e `placa_software`.

### 7.3 Ordem de chegada e espera

- **Câmera chega primeiro.** O conciliador procura uma leitura do software da mesma câmera nos últimos 20 s. Se não
  houver, **espera até 5 s** por ela antes de seguir (aprovado em 19/11). As fotos da
  câmera já levam esse tempo para baixar, então o operador não percebe atraso. Depois segue com a melhor placa
  disponível; se a do software chegar mais tarde, vale a correção da seção 7.4.
- **Software chega primeiro.** A leitura fica em `Identificacoes` como `aguardando` e é casada quando a câmera chegar.
- **Software sem câmera.** Se, 20 s depois da `passagem`, nenhuma leitura da câmera casou, o
  conciliador cria a entrada (ou registra a saída) com a placa do software, pelo **mesmo caminho do fluxo atual**:
  entrada automática, saída pela placa exata, pela placa próxima ou saída sem entrada. Fica `origem = software`.
- **Manobra.** `passagem` com direção `nenhuma`, ou com o sentido contrário ao da câmera: a identificação vira
  `descartada`. Se a câmera tiver gerado entrada para esse veículo, a entrada é mantida e marcada para revisão; não
  é apagada automaticamente.

### 7.4 Correção depois do fato (aprovada em 19/11)

Se a placa do software chegar depois de a câmera já ter gerado a entrada ou a saída com outra placa (por exemplo, o
software só firmou a placa no fim da passagem), **a correção é automática e no mesmo registro**:

- **Nunca se cria uma segunda entrada.** A leitura tardia do software é casada com a `Identificacoes` que a câmera já
  abriu (mesma janela da seção 7.1); a linha passa a `origem = ambos`, com `placa_camera` e `placa_software`
  preenchidas, e `placa_final` passa a ser a do software.
- **Entrada:** troca a placa do `Trafego` já criado (o mesmo `trafego_id`) pela do software e refaz a marcação de
  green list e red list (`in_whitelist`, `in_blacklist`).
- **Saída:** se a saída da câmera ficou sem entrada (`Saidas_nao_identificadas`) ou foi associada por placa próxima,
  o conciliador refaz a busca com a placa do software. Se achar a entrada, registra a saída nela. Se a associação
  automática anterior estava em outra entrada, desfaz com `desassociar` (já existe em
  `saidaNaoIdentificada.service.js`). A saída continua sendo uma só.
- **Registro tocado pelo operador** (baixa manual, edição da placa, associação manual): **o valor do operador
  prevalece** (decidido em 19/11). A correção do software não é aplicada ao `Trafego`, mas **nenhuma leitura é
  perdida**: a mesma linha de `Identificacoes` guarda `placa_camera`, `placa_software` e `placa_operador`, com
  `fonte_placa_final = operador`, e o `historico` registra a leitura do software que chegou depois e não foi
  aplicada. A identificação fica com `divergente = true` para revisão.
- **Edição pelo operador depois de uma correção automática:** vale a regra acima; a placa do operador passa a ser a
  final e as anteriores continuam no registro e no `historico`.
- **Red list:** como em 7.2, uma placa da red list lida pela câmera nunca é trocada.
- Toda correção grava em `Identificacoes` a placa anterior e o instante da troca, em `historico` (JSON), para
  auditoria.

### 7.5 Veículos sem placa (motos nas câmeras de frente)

Fora desta etapa (seção 13, backlog). Até lá, a passagem de um veículo sem placa é só gravada em `Identificacoes`, com
`placa_final = null` e foto, sem efeito no tráfego, mesmo com a câmera ligada.

## 8. Telas

- **Cadastro da câmera** (`FormCamera.vue`): interruptor "Identificação por software" e, para administrador, a foto
  da câmera com a linha virtual e a área desenhadas por cima (seção 4).
- **Tráfego** (cartões e listas): selo com a origem da entrada e da saída ("câmera", "software", "câmera +
  software"). Na divergência, as duas placas e a foto de cada solução lado a lado.
- **Relatório "Identificação por software"** por câmera e período, com os números da seção 1.1 calculados no
  próprio banco:
  - quantas passagens cada solução identificou e quantas os dois identificaram;
  - divergências;
  - leitura de placa de dia e de noite;
  - entradas criadas só pelo software;
  - saídas que acharam entrada graças a ele.
- **Revisão de divergências:** lista das passagens com `divergente = true`, com as duas fotos. O operador marca quem
  acertou, e isso dá a taxa de acerto real de cada solução ao longo do tempo.

## 9. Fases

| Fase | O que | Onde | Critério para seguir |
|---|---|---|---|
| 1 | Migração (`Identificacoes`, campos novos), conciliador e rotas | HML | testes do conciliador passam |
| 2 | Serviço `identificacao-software` lendo a configuração do sistema; tela de desenho da linha virtual e da área no cadastro da câmera; desligar o protótipo. **Todas as 4 câmeras habilitadas no HML** (linha e área de cada uma), ligadas | HML | `Identificacoes` das 4 câmeras com números coerentes com o protótipo; CPU medida com as 4 ao mesmo tempo |
| 3 | Conferência das 4 câmeras ligadas no HML (1 a 2 semanas) | HML | entradas criadas pelo software conferem com as fotos; nenhuma entrada ou saída duplicada; correções tardias (7.4) no mesmo registro |
| 4 | Produção com o serviço instalado e **todas as câmeras desligadas por padrão**; liga-se pelo cadastro só as câmeras escolhidas, começando pela B2 | produção | queda das saídas sem entrada nas câmeras ligadas; CPU da máquina dentro do limite |
| 5 | Demais câmeras em produção, uma por vez, conforme a capacidade da máquina | produção | relatório da câmera recém-ligada conferido na primeira semana |

**Capacidade:** o HML roda na mesma máquina que a produção. Com as 4 câmeras no HML são ~4 núcleos a mais (de 12; a
produção usa pouco hoje). O limite de 5 CPUs do container protege a produção. Na fase 4, cada câmera ligada em
produção soma ~1 núcleo; por isso o padrão em produção é desligado, e o HML deve ser desligado (ou reduzido) quando a
produção passar a usar o software, para não processar o mesmo vídeo duas vezes.

Produção: migração manual com dump antes; mudanças em `/home/digicam/docker-compose.yml` e `nginx.conf` só com
autorização, com cópia antes (regras de produção). Cada fase segue o procedimento de publicação (HML `r<N>` →
`prod-r<N>`).

## 10. Testes

- **Conciliador** (testes unitários no `backend/tests/unitario/`): casamento por janela e por placa; decisão por modo;
  red list e green list; câmera antes e depois do software; software sem câmera; manobra; idempotência dos
  eventos (`rastro` repetido); correção depois do fato **no mesmo registro**: a leitura tardia do software troca a
  placa do mesmo `Trafego`, nunca cria uma segunda entrada, e refaz a busca da saída sem duplicá-la.
- **Integração** (`backend/tests/integracao/`): leitura da câmera + eventos do software → `Trafegos` e
  `Saidas_nao_identificadas` corretos nos 5 casos da tabela 7.2.
- **Serviço:** os 22 testes do protótipo, mais fila local, reenvio e troca de configuração em execução.
- **Cadastro:** validação do `config_software` (pontos dentro da imagem, ponto de dentro fora da margem, polígono
  válido) e conversão das coordenadas da tela para pixels da imagem original.
- **Operador:** edição da placa depois de uma correção automática e correção do software depois de uma edição do
  operador; nos dois casos vale o operador e as três leituras continuam no mesmo registro.
- **Regressão:** com todas as câmeras desligadas, o resultado de um dia reprocessado tem que ser idêntico ao de hoje.

## 11. Riscos

| Risco | Mitigação |
|---|---|
| Software cria entrada falsa (sombra, pedestre, veículo parado) | HML antes de produção; desligar no cadastro a qualquer momento; exigência de cruzar a linha; área de interesse; revisão de divergências |
| Software lê placa errada e "corrige" uma leitura certa da câmera | o protótipo acertou 15 de 16 divergências, mas a câmera pode ser desligada no cadastro na hora; red list nunca é trocada |
| Mesmo veículo contado duas vezes (rastro partido) | `rastro` único; casamento por janela; no protótipo, menos de 1% |
| CPU: ~1 núcleo por câmera | limite de 5 CPUs no container; medir na fase 2 antes de ligar mais câmeras |
| Câmera com limite de conexões RTSP | uma conexão a mais por câmera; o `go2rtc` usa o canal 102 e o software o 101 |
| Disco (fotos do software) | ~1 foto e 1 recorte por passagem; entram na rotina de arquivamento do S3 |

## 12. Decisões

Tomadas em 19/11:

- espera de até 5 s pela leitura do software quando a câmera chega primeiro (7.3);
- correção automática quando a placa do software chega depois, sempre no mesmo registro, sem duplicar a entrada (7.4);
- só dois estados no cadastro: desligada e ligada (4);
- HML com as 4 câmeras ligadas; produção com todas desligadas por padrão, ligadas pelo cadastro (9);
- motos e veículos sem placa ficam para depois (13);
- linha virtual e área desenhadas sobre a foto da câmera, no cadastro (4);
- em registro editado pelo operador vale o valor do operador, mas todas as leituras (câmera, software e operador)
  ficam guardadas no mesmo registro (7.4).

Não há decisões pendentes.

## 13. Backlog

- **Motos e veículos sem placa nas câmeras de frente.** Na B2 o software vê ~80 motos por dia que nenhuma câmera de
  entrada lê (a moto só tem placa traseira). Ideia: lista "Entradas sem placa" no painel de tráfego, com a foto; o
  operador digita a placa (cria a entrada com `fonte_placa_final = operador`) ou associa a passagem a uma saída sem
  entrada lida pela câmera de saída, que vê a traseira, com a mesma interação de arrastar/associar do painel de
  saídas.
- **Revisão de divergências com marcação de quem acertou**, para medir a taxa de acerto de cada solução ao longo do
  tempo (se não entrar na fase 3).
