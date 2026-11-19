# Plano: backup diário do MySQL de produção (shell + crontab)

Levantamento feito em 2026-11-19 na máquina `serverbosque` (10.0.0.126). Nada deste plano foi executado.

## 1. Objetivo

Hoje não existe backup do banco de produção. Os únicos dumps são parciais, feitos à mão antes de intervenções
(`/home/digicam/hml/dump/`, por exemplo `prod_Trafegos_Saidas_antes_restauro_2026-10-23_0413.sql.gz`). Uma falha no
disco, um `DELETE` errado ou uma migração com problema não teriam como ser desfeitos.

A rotina deve:

- fazer um dump completo por dia, sem parar nem travar a aplicação;
- conferir se cada dump está íntegro e se volta a funcionar (teste de restauração);
- guardar cópias por dia, semana e mês, também **fora da máquina**;
- avisar quando falhar.

## 2. Situação atual

| Item | Valor |
|---|---|
| Servidor | MySQL 8.0.46 nativo no Ubuntu 22.04 (`/usr/sbin/mysqld`, serviço `mysql`), dados em `/var/lib/mysql/` |
| Banco | `digicam_db`, 17 tabelas, todas InnoDB, ~466 MB |
| Maiores tabelas | `Saidas_nao_identificadas` 228 MB (757 mil linhas), `Trafegos` 191 MB (215 mil), `Anomalia_execucoes` 35 MB |
| Binlog | ligado, guardado por 3 dias (`binlog_expire_logs_seconds = 259200`), sem GTID |
| Ferramentas no host | `mysqldump` 8.0.46, `zstd`, `gzip` |
| Dump medido em 19/11 | **5 s**, 337 MB em SQL, **34 MB** com `zstd -10` |
| Disco | 26 GB livres (73%) depois da limpeza de 19/11 |
| Crontab do usuário `digicam` | só `0 * * * * /home/digicam/reiniciar.sh` (reinício de hora em hora) |

O MySQL do HML (container `digicam-hml_mysql_1`, banco `digicam_hml`) é de teste e fica fora deste plano.

## 3. Solução

Um script `/home/digicam/backup/backup_mysql.sh`, rodado pelo crontab do usuário `digicam` às **03:30 (horário
local)**, que:

1. faz o dump com `mysqldump --single-transaction` (fotografia consistente do InnoDB, sem bloquear escrita);
2. comprime com `zstd` e grava com nome temporário;
3. confere a integridade: descompressão sem erro, linha final `-- Dump completed`, tamanho mínimo;
4. renomeia para o nome final e grava o SHA-256 e a contagem de linhas das tabelas principais;
5. aplica a retenção (diário, semanal, mensal);
6. envia a cópia para fora da máquina (S3);
7. registra o resultado em log e num arquivo de situação lido pelo monitoramento.

Um segundo script, `restaurar_teste.sh`, roda **uma vez por semana**, restaura o último dump num MySQL temporário
em container e compara as contagens. Backup que nunca foi restaurado não é backup confiável.

### 3.1 Horário

O relógio da máquina está em UTC e o crontab usa UTC. 03:30 no horário local (America/Bahia, UTC−3) é **06:30 UTC**.
O horário fica:

- longe da hora cheia, em que o `reiniciar.sh` derruba e sobe a aplicação;
- depois do arquivamento de fotos para o S3, planejado para 02:00 (`docs/plano_mudanca_s3.md`);
- antes do movimento da manhã (as saídas sobem a partir das 05:00–06:00 locais). Como o dump leva 5 s, o impacto é
  desprezível em qualquer horário.

## 4. Estrutura de arquivos

```
/home/digicam/backup/
  backup_mysql.sh          # rotina diária
  restaurar_teste.sh       # teste semanal de restauração
  .backup.cnf              # credenciais (chmod 600), fora do git
  backup.log               # log das execuções
  situacao                 # última execução: OK/ERRO, data, tamanho (lido pelo monitoramento)
  mysql/
    diario/   digicam_db_2026-11-20_0330.sql.zst  (+ .sha256, .contagens)
    semanal/  cópia do dump de domingo
    mensal/   cópia do dump do dia 1
```

Os scripts ficam versionados no repositório em `scripts/backup/` e são copiados para `/home/digicam/backup/` na
instalação. As credenciais nunca vão para o git.

## 5. Usuário do MySQL para o backup

Usuário próprio, só com o necessário para ler e registrar a posição do binlog (usada na recuperação até um
instante, seção 8.2):

```sql
CREATE USER 'digicam_backup'@'localhost' IDENTIFIED BY '<senha forte>';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES ON digicam_db.* TO 'digicam_backup'@'localhost';
GRANT RELOAD, REPLICATION CLIENT, PROCESS ON *.* TO 'digicam_backup'@'localhost';
```

`/home/digicam/backup/.backup.cnf` (`chmod 600`), para a senha não aparecer na linha de comando nem no `ps`:

```ini
[client]
user=digicam_backup
password=<senha forte>
host=localhost
```

## 6. Script diário (`backup_mysql.sh`)

Esboço; a versão final ganha testes manuais na fase 1 (seção 10).

```bash
#!/usr/bin/env bash
# Backup diário do digicam_db: dump consistente, compressão, conferência, retenção e cópia externa.
set -euo pipefail

BASE=/home/digicam/backup
DESTINO=$BASE/mysql
CNF=$BASE/.backup.cnf
BANCO=digicam_db
DIAS_DIARIO=14        # dumps diários guardados
SEMANAS=8             # dumps de domingo
MESES=12              # dumps do dia 1
MINIMO_BYTES=$((10 * 1024 * 1024))   # dump comprimido menor que isso é suspeito (hoje: 34 MB)
S3_DESTINO=${S3_DESTINO:-}           # ex.: s3://<bucket>/backup/mysql (vazio = sem cópia externa)

exec 9>"$BASE/.trava"; flock -n 9 || { echo "$(date -Is) já existe um backup rodando" >>"$BASE/backup.log"; exit 1; }

registrar() { echo "$(date -Is) $*" >>"$BASE/backup.log"; }
falhar()    { registrar "ERRO: $*"; echo "ERRO $(date -Is) $*" >"$BASE/situacao"; exit 1; }
trap 'falhar "interrompido na linha $LINENO"' ERR

AGORA=$(TZ=America/Bahia date +%F_%H%M)
ARQ=$DESTINO/diario/${BANCO}_$AGORA.sql.zst
TMP=$ARQ.parcial
mkdir -p "$DESTINO"/{diario,semanal,mensal}

# espaço: pelo menos 3x o último dump livre no disco
ULTIMO=$(ls -1t "$DESTINO"/diario/*.sql.zst 2>/dev/null | head -1 || true)
PRECISA=$(( ${ULTIMO:+$(stat -c %s "$ULTIMO")} + 0 ))
LIVRE=$(( $(df --output=avail -B1 "$DESTINO" | tail -1) ))
[ "$LIVRE" -gt $(( PRECISA * 3 + 500*1024*1024 )) ] || falhar "pouco espaço em disco ($LIVRE bytes livres)"

registrar "início do dump em $ARQ"
mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --routines --triggers --events \
  --no-tablespaces --set-gtid-purged=OFF --source-data=2 --default-character-set=utf8mb4 "$BANCO" \
  | zstd -q -T2 -10 -o "$TMP"

# conferência
zstd -t -q "$TMP"                                   || falhar "arquivo comprimido corrompido"
zstd -dc "$TMP" | tail -1 | grep -q '^-- Dump completed' || falhar "dump incompleto"
[ "$(stat -c %s "$TMP")" -ge "$MINIMO_BYTES" ]      || falhar "dump pequeno demais ($(stat -c %s "$TMP") bytes)"

mv "$TMP" "$ARQ"
sha256sum "$ARQ" >"$ARQ.sha256"
mysql --defaults-extra-file="$CNF" -N "$BANCO" -e \
  "SELECT 'Trafegos', COUNT(*) FROM Trafegos UNION ALL SELECT 'Saidas_nao_identificadas', COUNT(*)
   FROM Saidas_nao_identificadas UNION ALL SELECT 'WhiteList', COUNT(*) FROM WhiteList
   UNION ALL SELECT 'Users', COUNT(*) FROM Users" >"$ARQ.contagens"

# retenção: domingo vira semanal, dia 1 vira mensal (hard link: não ocupa espaço a mais)
[ "$(TZ=America/Bahia date +%u)" = 7 ]  && ln -f "$ARQ" "$DESTINO/semanal/$(basename "$ARQ")"
[ "$(TZ=America/Bahia date +%d)" = 01 ] && ln -f "$ARQ" "$DESTINO/mensal/$(basename "$ARQ")"
find "$DESTINO/diario"  -name '*.sql.zst*' -mtime +"$DIAS_DIARIO"      -delete
find "$DESTINO/semanal" -name '*.sql.zst'  -mtime +$((SEMANAS * 7))    -delete
find "$DESTINO/mensal"  -name '*.sql.zst'  -mtime +$((MESES * 31))     -delete

# cópia externa
if [ -n "$S3_DESTINO" ]; then
  aws s3 cp --only-show-errors "$ARQ" "$S3_DESTINO/" && aws s3 cp --only-show-errors "$ARQ.sha256" "$S3_DESTINO/" \
    || falhar "falha ao enviar para $S3_DESTINO (o dump local está íntegro)"
fi

TAM=$(du -h "$ARQ" | cut -f1)
registrar "OK $ARQ ($TAM)"
echo "OK $(date -Is) $(basename "$ARQ") $TAM" >"$BASE/situacao"
```

Pontos de atenção do script:

- `--single-transaction` garante consistência sem travar porque todas as tabelas são InnoDB; uma tabela MyISAM
  nova quebraria essa garantia (o teste semanal confere o engine).
- `--source-data=2` grava como comentário a posição do binlog no início do dump; precisa de `RELOAD` (faz um
  `FLUSH TABLES WITH READ LOCK` de milissegundos no início).
- `--quick` lê linha a linha, sem carregar tabelas inteiras na memória.
- O nome temporário `.parcial` evita que um dump pela metade seja tomado como bom.
- `flock` impede duas execuções ao mesmo tempo.

### 6.1 Crontab (usuário `digicam`)

```cron
# backup diário do MySQL às 03:30 (horário local) = 06:30 UTC
30 6 * * *  /home/digicam/backup/backup_mysql.sh  >>/home/digicam/backup/backup.log 2>&1
# teste de restauração aos domingos, 04:15 local = 07:15 UTC
15 7 * * 0  /home/digicam/backup/restaurar_teste.sh >>/home/digicam/backup/backup.log 2>&1
```

O log é rotacionado pelo `logrotate` do usuário (ou pelo próprio script, se passar de 10 MB).

## 7. Teste semanal de restauração (`restaurar_teste.sh`)

1. Sobe um MySQL temporário: `docker run -d --rm --name restauro-teste -e MYSQL_ROOT_PASSWORD=<aleatória>
   --tmpfs /var/lib/mysql:size=3g mysql:8.0` (a imagem `mysql:8.0` já está na máquina; dados em memória, nada
   fica no disco).
2. Espera o MySQL responder e restaura: `zstd -dc <último dump> | docker exec -i restauro-teste mysql -uroot ...`.
3. Compara as contagens de `Trafegos`, `Saidas_nao_identificadas`, `WhiteList` e `Users` com o `.contagens` do
   dump, e confere que nenhuma tabela é diferente de InnoDB.
4. Mede o tempo da restauração (meta: menos de 10 minutos) e registra no log.
5. Remove o container (`docker rm -f`), mesmo em caso de erro (`trap`).

Resultado em `situacao_restauro`, no mesmo formato de `situacao`.

## 8. Restauração

### 8.1 Restaurar o banco inteiro a partir de um dump

Só com autorização explícita: substitui os dados de produção.

1. Dump de segurança do estado atual, mesmo se estiver ruim: `backup_mysql.sh` (ou `mysqldump` à mão em
   `/home/digicam/hml/dump/`).
2. Parar a aplicação para ninguém gravar durante a restauração: `cd /home/digicam && docker-compose stop backend
   anomalias verificar_placas` (lembrar que o `reiniciar.sh` da hora cheia sobe tudo de novo: comentar a linha no
   crontab durante a operação).
3. Conferir o arquivo: `sha256sum -c <dump>.sha256`.
4. Restaurar em um banco novo e trocar depois, para não perder o atual se algo der errado:
   `mysql -e 'CREATE DATABASE digicam_db_restauro'` e
   `zstd -dc <dump> | mysql digicam_db_restauro`.
5. Conferir contagens e algumas consultas; então trocar os nomes (renomear tabelas ou apontar o `.env` para o banco
   restaurado).
6. Subir a aplicação e reativar a linha do crontab.

### 8.2 Recuperar até um instante (point-in-time)

Para desfazer um erro no meio do dia (por exemplo, um `DELETE` às 15:12): restaurar o dump da madrugada e reaplicar
o binlog desde a posição gravada no dump até um pouco antes do erro:

```bash
zstd -dc <dump> | head -50 | grep 'CHANGE REPLICATION SOURCE'    # arquivo e posição do binlog
mysqlbinlog --start-position=<pos> --stop-datetime='2026-11-20 18:11:00' /var/lib/mysql/binlog.0000NN ... | mysql ...
```

Os binlogs ficam só 3 dias e só na máquina; se a recuperação precisar de mais, aumentar
`binlog_expire_logs_seconds` (cuidado com disco: em 10/10 o binlog chegou a 25 GB) ou copiar os binlogs para o S3
junto com o dump.

## 9. Cópia fora da máquina

Backup só no mesmo disco não protege de falha do disco, roubo ou incêndio no condomínio.

- **Recomendado:** S3 no mesmo bucket do arquivamento de fotos (`docs/plano_mudanca_s3.md`), prefixo
  `backup/mysql/`, com regra de ciclo de vida: diários apagados depois de 35 dias, mensais mantidos por 12 meses.
  Usuário IAM só com `PutObject` nesse prefixo (o servidor não consegue apagar nem sobrescrever backups antigos:
  protege contra ransomware). Com Object Lock em modo governance, nem quem tem a chave apaga antes do prazo.
- Custo: 34 MB por dia → ~1,2 GB em 35 dias + 12 mensais (~0,4 GB) ≈ 1,6 GB → **menos de US$ 0,05 por mês** em S3
  Standard (US$ 0,023/GB-mês, preço de tabela em `us-east-2`; conferir na calculadora da AWS).
- Ferramenta: `aws` CLI v2 instalado no usuário `digicam`, credenciais em `~/.aws/credentials` (`chmod 600`).
- Banda: 34 MB por noite, desprezível.

## 10. Monitoramento e alerta

- `situacao` e `situacao_restauro` com `OK`/`ERRO` e data. Se o plano de observabilidade for executado
  (`docs/plano_observabilidade.md`), um coletor de texto do node_exporter lê esses arquivos e o Grafana alerta quando:
  a última execução falhou, o último `OK` tem mais de 26 h, ou o tamanho caiu mais de 30% de um dia para o outro.
- Enquanto não houver Grafana: o próprio script envia o erro por e-mail (precisa de `msmtp` configurado) ou por um
  webhook (Telegram/WhatsApp/Slack), a decidir (seção 12).
- O painel de anomalias pode mostrar um aviso "backup atrasado" lendo `situacao` (opcional).

## 11. Fases

| Fase | O que | Critério para seguir |
|---|---|---|
| 1 | Criar o usuário `digicam_backup`, `.backup.cnf`, os scripts em `scripts/backup/`; rodar à mão | dump OK, conferência OK, restauração de teste OK |
| 2 | Instalar no crontab só o backup local; acompanhar 1 semana | 7 `OK` seguidos em `situacao` |
| 3 | Teste semanal de restauração no crontab | 1º domingo com restauração OK e tempo medido |
| 4 | Cópia para o S3 (depende da conta AWS da fase 0 do plano do S3) | arquivo e `.sha256` aparecem no bucket; download confere |
| 5 | Alerta (e-mail/webhook ou Grafana) | um erro provocado de propósito (senha errada) gera aviso |

Criar o usuário no MySQL e mexer no crontab são mudanças em produção: só com autorização explícita, conforme as
regras de produção.

## 12. Decisões pendentes

1. **Retenção:** 14 diários, 8 semanais e 12 mensais localmente (~1 GB) está bom? E no S3, 35 dias de diários e 12
   meses de mensais?
2. **Cópia externa:** S3 (recomendado) ou outro destino (outra máquina na rede, disco externo)?
3. **Canal de alerta:** e-mail, Telegram/WhatsApp ou só Grafana?
4. **Recuperação até um instante:** basta o binlog de 3 dias na máquina, ou copiar os binlogs para o S3?
5. **HML:** incluir o banco `digicam_hml`? (Hoje não há motivo: é recriado a partir de produção.)
