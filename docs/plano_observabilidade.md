# Plano de observabilidade — Grafana, métricas, logs e alertas

Levantamento feito em 2026-10-10/11 na máquina `serverbosque` (10.0.0.126). Nada deste plano foi executado.

## 1. Objetivo

Passar a enxergar, em um só lugar, a saúde da máquina, dos containers, do MySQL e da aplicação, e ser avisado
quando algo sair do normal. Os problemas encontrados em 10/10 servem de régua: todos deveriam ter gerado alerta.

| Problema real de 10/10 | Como passa a ser detectado |
|---|---|
| Backend de produção reiniciando a cada 2–3 min | alerta de reinícios do container (cAdvisor) |
| Disco em 83% | alerta de espaço em disco (node_exporter) |
| 25 GB de binlog no MySQL | painel e alerta de tamanho do binlog (mysqld_exporter) |
| Respostas 502 no nginx durante os reinícios | sonda HTTP em `/digicam/health` (blackbox) e taxa de 5xx nos logs |
| Saídas não registradas | painel de negócio lendo o MySQL |
| Migração falhando a cada start | busca e alerta por texto nos logs (Loki) |

Fora do escopo: rastreamento distribuído (tracing) e qualquer mudança no código da aplicação. A instrumentação
do backend fica como etapa futura (seção 8).

## 2. Capacidade da máquina

| Recurso | Disponível hoje | Consumo estimado da pilha | Limite configurado |
|---|---|---|---|
| CPU | 12 núcleos, carga média 0,2 | menos de 1 núcleo | 3 núcleos somados |
| Memória | 13 GB disponíveis de 15 GB | 1 a 1,5 GB | 2,5 GB somados |
| Disco | 43 GB livres (55% usado) | 5 a 10 GB | 5 GB métricas + 7 dias de logs |

Os consumos são estimativas típicas dessas ferramentas; os valores reais aparecem no próprio Grafana após a
instalação e os limites podem ser ajustados.

## 3. Arquitetura

```
 navegador ──► 10.0.0.126:3001 ──► Grafana ──┬──► Prometheus ──┬──► node_exporter      (máquina)
                                             │                 ├──► cAdvisor           (containers)
                                             │                 ├──► mysqld_exporter ──► MySQL do host
                                             │                 └──► blackbox ──► http://10.0.0.126/...
                                             ├──► Loki ◄── Alloy ◄── logs de todos os containers
                                             └──► MySQL do host (usuário só leitura, painéis de negócio)
```

| Componente | Função | Exposto fora da máquina |
|---|---|---|
| Grafana | painéis e alertas | sim, `10.0.0.126:3001` |
| Prometheus | banco de métricas, retenção 15 dias / 5 GB | não (`127.0.0.1:9090`) |
| node_exporter | CPU, memória, disco, rede, inodes | não |
| cAdvisor | uso e reinícios por container | não |
| mysqld_exporter | conexões, consultas lentas, binlog, InnoDB | não |
| blackbox_exporter | sondas HTTP da aplicação | não |
| Loki | banco de logs, retenção 7 dias | não |
| Alloy | coleta os logs dos containers via Docker | não |

Decisões:

| Tema | Escolha | Motivo |
|---|---|---|
| Isolamento | projeto compose próprio `digicam-obs`, rede própria | nada entra na rede de produção (ver item 4.1) |
| Arquivos de produção | nenhum é alterado | o Grafana tem porta própria; não passa pelo nginx de produção |
| Porta do Grafana | 3001 | a 3000 padrão é do backend de produção |
| Coletor de logs | Grafana Alloy | o Promtail chegou ao fim de vida em março de 2026 |
| Identificação dos containers | nome do serviço compose | o cron recria os containers de produção a cada hora e o ID muda |
| Métricas de negócio | Grafana lendo o MySQL direto | não exige mudar o código |
| Versões das imagens | fixadas no `.env`, nunca `latest` | atualização controlada |

## 4. Cuidados específicos desta máquina

1. **Não ligar nenhum container à rede `digicam_digicam_network`.** O cron horário faz
   `docker-compose down && up -d`; com um container externo na rede, o `down` falha e produção não sobe.
2. **O firewall `ufw` está ativo** e as regras não foram lidas (exige `sudo`). Portas publicadas pelo Docker não
   passam pelo `ufw`, mas o `node_exporter` usa a rede do host: o acesso do Prometheus a `10.0.0.126:9100` pode
   precisar de uma regra (Fase 0).
3. **As sondas partem de outra rede bridge** para a porta 80 publicada por produção. É o mesmo teste de rede da
   Fase 0 do `plano_deploy_hml.md`; se falhar, o `blackbox` passa a usar a rede do host.
4. **O backend imprime muito log** (objetos inteiros do Sequelize a cada placa). O Loki fica com retenção de
   7 dias e limite de taxa de ingestão.
5. **O Alloy e o cAdvisor leem o socket do Docker**, o que equivale a acesso de administrador à máquina. Ficam
   sem porta publicada e com o socket montado como somente leitura.
6. **Monitoramento na mesma máquina não avisa se a máquina cair.** A Fase 6 inclui um sinal de vida externo.

## 5. Fases

### Fase 0 — Pré-checagens

```bash
df -h /                                        # pelo menos 15 GB livres
ss -ltn | grep -E ':(3001|9090|9100)\b'        # deve sair vazio
sudo ufw status verbose                        # anotar regras para 3306 e a política de entrada
```

Teste de rede entre bridges (igual ao do plano de homologação):

```bash
docker network create obs-teste-rede
docker run --rm --pull never --network obs-teste-rede nginx:alpine \
  wget -q -T 5 -O /dev/null http://10.0.0.126/digicam/health && echo REDE_OK
docker network rm obs-teste-rede
```

Se o `ufw` bloquear o acesso das redes Docker ao host, liberar só a porta do `node_exporter`:

```bash
sudo ufw allow from 172.16.0.0/12 to any port 9100 proto tcp
```

### Fase 1 — Arquivos no repositório

Criar `observabilidade/`:

```
observabilidade/
├── docker-compose.yml
├── .env.example              # versões das imagens e senhas (o .env real não é versionado)
├── prometheus/prometheus.yml
├── prometheus/regras.yml     # regras de alerta baseadas em métricas
├── blackbox/blackbox.yml
├── loki/loki.yml
├── alloy/config.alloy
└── grafana/provisioning/     # fontes de dados, painéis e alertas como arquivos
```

Pontos obrigatórios do `docker-compose.yml`:

- `COMPOSE_PROJECT_NAME=digicam-obs` no `.env` e uso de `-p digicam-obs` em todo comando;
- todos os serviços com `restart: unless-stopped`, `mem_limit`, `cpus` e log limitado (`10m` × 3);
- volumes nomeados para Prometheus, Loki e Grafana;
- portas publicadas: apenas `10.0.0.126:3001:3000` (Grafana) e `127.0.0.1:9090:9090` (Prometheus);
- `node_exporter` com `network_mode: host`, `pid: host` e `/:/host:ro,rslave`;
- `cadvisor` com `--docker_only=true`, `--housekeeping_interval=30s` e apenas os rótulos
  `com.docker.compose.project` e `com.docker.compose.service`;
- Prometheus com `--storage.tsdb.retention.time=15d` e `--storage.tsdb.retention.size=5GB`.

Limites sugeridos:

| Serviço | Memória | CPU |
|---|---|---|
| Prometheus | 768 MB | 1 |
| Loki | 768 MB | 1 |
| Grafana | 384 MB | 0,5 |
| cAdvisor | 256 MB | 0,5 |
| Alloy | 256 MB | 0,5 |
| exporters (cada) | 64 MB | 0,2 |

Alvos do Prometheus (`prometheus.yml`):

| Job | Alvo |
|---|---|
| `maquina` | `10.0.0.126:9100` |
| `containers` | `cadvisor:8080` |
| `mysql` | `mysqld-exporter:9104` |
| `sonda_http` | `http://10.0.0.126/` e `http://10.0.0.126/digicam/health` via `blackbox:9115` |
| `prometheus` | `localhost:9090` |

Quando a homologação existir, acrescentar `http://10.0.0.126:8081/digicam/health` às sondas.

Coleta de logs (`alloy/config.alloy`):

```alloy
discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
}

discovery.relabel "containers" {
  targets = discovery.docker.containers.targets
  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/(.*)"
    target_label  = "container"
  }
  rule {
    source_labels = ["__meta_docker_container_label_com_docker_compose_project"]
    target_label  = "projeto"
  }
  rule {
    source_labels = ["__meta_docker_container_label_com_docker_compose_service"]
    target_label  = "servico"
  }
}

loki.source.docker "containers" {
  host       = "unix:///var/run/docker.sock"
  targets    = discovery.relabel.containers.output
  forward_to = [loki.write.local.receiver]
}

loki.write "local" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}
```

Validar: `cd observabilidade && docker-compose -p digicam-obs config -q`.

### Fase 2 — Usuários somente leitura no MySQL (como root)

```sql
CREATE USER 'obs_exporter'@'%' IDENTIFIED BY '<senha>' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT ON *.* TO 'obs_exporter'@'%';
GRANT SELECT ON performance_schema.* TO 'obs_exporter'@'%';

CREATE USER 'obs_grafana'@'%' IDENTIFIED BY '<senha>' WITH MAX_USER_CONNECTIONS 5;
GRANT SELECT ON digicam_db.* TO 'obs_grafana'@'%';
```

- Nenhum dos dois consegue escrever no banco.
- `MAX_USER_CONNECTIONS` impede que um painel mal escrito esgote as conexões da aplicação.
- As colunas `login` e `senha` de `Cameras` ficam legíveis para o `obs_grafana`. Para evitar, trocar o último
  `GRANT` por permissões por tabela, deixando `Cameras` e `Users` de fora ou só com as colunas necessárias.

### Fase 3 — Subir a pilha

```bash
cd /home/digicam/projeto/src/observabilidade
docker-compose -p digicam-obs pull
docker-compose -p digicam-obs up -d
docker-compose -p digicam-obs ps
curl -s http://127.0.0.1:9090/api/v1/targets | grep -o '"health":"[a-z]*"' | sort | uniq -c
```

Todos os alvos devem estar `up`. Alvo `down` na `maquina` indica `ufw` (Fase 0); nas `sonda_http`, o teste de
rede entre bridges.

Depois: abrir `http://10.0.0.126:3001/`, trocar a senha do `admin` e criar um usuário de leitura para quem só
consulta.

### Fase 4 — Painéis

Provisionados por arquivo, para ficarem versionados no repositório.

| Painel | Fonte | Conteúdo principal |
|---|---|---|
| Máquina | Prometheus | CPU, memória, disco (uso e previsão de esgotamento), rede, temperatura se disponível |
| Containers | Prometheus | CPU e memória por serviço, reinícios, tempo no ar |
| MySQL | Prometheus | conexões, consultas por segundo, consultas lentas, tamanho do binlog, InnoDB |
| Disponibilidade | Prometheus | resultado e tempo de resposta das sondas, histórico de quedas |
| Logs | Loki | busca por serviço, erros por minuto, taxa de 5xx do nginx |
| Operação da portaria | MySQL | indicadores de negócio (abaixo) |

Indicadores de negócio, lidos de `digicam_db`:

| Indicador | Origem |
|---|---|
| Entradas por hora | `Trafegos.dataEntrada` |
| Saídas por hora, automáticas × manuais | `Trafegos.dataSaida`, `saida_automatica` |
| Veículos em travessia sem saída | `Trafegos` com `destino = 'cruzar'` e `dataSaida IS NULL` |
| Saídas sem entrada identificada por hora e por câmera | `Saidas_nao_identificadas.data`, `camera_id` |
| Permanência média | diferença entre `dataSaida` e `dataEntrada` |
| Placas lidas por câmera | contagem de `Inserindo placa:` nos logs do `verificar_placas` (Loki) |

Exemplo de consulta no Grafana:

```sql
SELECT $__timeGroupAlias(dataEntrada, '1h'), COUNT(*) AS entradas
FROM Trafegos
WHERE $__timeFilter(dataEntrada) AND client_id = 2
GROUP BY 1 ORDER BY 1;
```

`Trafegos` tem ~236 mil linhas; toda consulta deve filtrar por período para usar índice.

### Fase 5 — Alertas

| Alerta | Condição | Gravidade |
|---|---|---|
| Aplicação fora do ar | sonda de `/digicam/health` falhando por 2 min | crítica |
| Backend reiniciando | mais de 3 inícios do container do backend em 30 min | crítica |
| Disco enchendo | menos de 15% livre, ou previsão de esgotar em 7 dias | alta |
| Binlog grande | mais de 5 GB de logs binários | média |
| MySQL sem conexões livres | mais de 80% de `max_connections` em uso por 5 min | alta |
| Memória da máquina | menos de 10% disponível por 10 min | alta |
| Câmeras em silêncio | nenhuma placa lida em 30 min entre 6h e 22h | alta |
| Erro de foto no SFTP | mais de 5 ocorrências de `No such file ftp/fotos` em 10 min | média |
| Migração falhando | `Error reading "config/config.json"` nos logs do backend | média |
| Coleta parada | qualquer alvo do Prometheus `down` por 5 min | média |

- O reinício horário do cron conta como um início por hora; o limite de 3 em 30 min já desconta isso.
- O alerta "Backend reiniciando" vai disparar no primeiro minuto enquanto o hotfix do backend não for publicado.
- O horário do alerta de câmeras deve ser ajustado ao movimento real da portaria.

**Decisão pendente:** canal de aviso. Sugestão: bot do Telegram em um grupo dos responsáveis (não exige servidor
de e-mail). Alternativas: e-mail via SMTP ou webhook.

### Fase 6 — Sinal de vida externo

Um serviço externo de "heartbeat" recebe um ping da máquina a cada 5 minutos e avisa quando o ping para. Cobre
queda de energia, de rede e travamento da própria máquina, que a pilha local não consegue avisar.

```cron
*/5 * * * * curl -fsS -m 10 --retry 3 -o /dev/null <URL do heartbeat>
```

Entra no crontab do usuário `digicam`, ao lado do reinício horário (linha nova, sem alterar a existente).

### Fase 7 — Validação

1. Todos os alvos `up` e os seis painéis com dados.
2. Logs dos quatro containers de produção pesquisáveis por `servico`.
3. Passar por uma hora cheia e confirmar que os painéis continuam contínuos após o reinício do cron.
4. Disparar um alerta de teste e confirmar a chegada no canal escolhido.
5. Conferir que produção não mudou: `docker network inspect digicam_digicam_network` lista só os quatro
   containers de produção, e `/home/digicam/reiniciar.log` mostra o reinício seguinte sem erro.
6. Após 24 horas, conferir o consumo real de memória e disco da pilha e ajustar limites e retenções.

## 6. Operação

| Tarefa | Comando (em `observabilidade/`) |
|---|---|
| Ver estado | `docker-compose -p digicam-obs ps` |
| Parar tudo (mantém dados) | `docker-compose -p digicam-obs stop` |
| Atualizar versão | alterar a versão no `.env`, `pull` e `up -d` |
| Recarregar regras do Prometheus | `docker-compose -p digicam-obs kill -s HUP prometheus` |
| Backup dos painéis | já estão em `grafana/provisioning/` no repositório |

## 7. Desmontagem

```bash
cd /home/digicam/projeto/src/observabilidade
docker-compose -p digicam-obs down -v      # remove containers, rede e volumes da pilha
```

Depois, como root do MySQL, `DROP USER 'obs_exporter'@'%', 'obs_grafana'@'%';`, remover a linha do heartbeat do
crontab e a regra do `ufw`, se tiver sido criada. Produção não é afetada em nenhum desses passos.

## 8. Etapas futuras

- **Métricas próprias do backend.** Endpoint `/metrics` com `prom-client`: tempo de resposta por rota, falhas na
  busca de foto no SFTP, tempo de consulta às câmeras, fila de identificações. Exige mudança de código e entra em
  um deploy posterior ao hotfix.
- **Log estruturado.** Trocar os `console.log` de objetos do Sequelize por linhas JSON curtas com nível. Reduz o
  volume no Loki e permite alertar por nível de erro em vez de texto.
- **Homologação.** Incluir os containers `digicam-hml` nos painéis (já são coletados automaticamente pelo cAdvisor
  e pelo Alloy; falta só a sonda HTTP e um filtro por `projeto`).
- **Limpeza de `/home/digicamftp`.** 16 GB de fotos brutas das câmeras; se não houver rotina de limpeza, o painel
  de disco vai mostrar o crescimento e a previsão de esgotamento.
