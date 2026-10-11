# Plano de deploy — ambiente de homologação (HML) paralelo à produção

Levantamento feito em 2026-10-10 na máquina `serverbosque` (10.0.0.126), somente com comandos de leitura.
Nada deste plano foi executado ainda.

## 1. Objetivo e resultado esperado

Subir, na mesma máquina que roda produção, uma segunda instância completa do sistema com o código da branch
`feature/abas-trafego-conciliacao`, com **banco próprio** e **fotos próprias**, acessível pelo **mesmo nginx** de
produção em outra porta.

| | Produção (não muda) | Homologação (novo) |
|---|---|---|
| Acesso | `http://10.0.0.126/` | `http://10.0.0.126:8081/` |
| Projeto compose | `digicam` em `/home/digicam` | `digicam-hml` em `projeto/src/homologacao` |
| Imagens | `digicam-*:latest` | `digicam-*:hml-<commit>` |
| Banco | MySQL do host, `digicam_db` (porta 3306) | MySQL 8.0 em container, `digicam_hml` (127.0.0.1:3307) |
| Fotos | `/digicam-fotos` | `/home/digicam/hml/fotos` |
| Backend (porta no host) | 3000 | 10.0.0.126:3100 |
| Frontend (porta no host) | 4000 | 10.0.0.126:4100 |
| Reinício horário (cron) | sim | não |

Impacto previsto em produção: nenhum até a Fase 6. A Fase 6 altera dois arquivos de produção e entra em vigor no
reinício horário que já acontece (sem indisponibilidade adicional).

## 2. O que o levantamento encontrou

Fatos que moldam o plano:

1. **Produção roda de `/home/digicam/docker-compose.yml`**, projeto `digicam`, e um cron executa
   `docker-compose down && docker-compose up -d` a cada hora cheia. O `down` remove a rede
   `digicam_digicam_network`.
   - Consequência: **nenhum container de HML pode ser ligado à rede de produção**. Com um container externo
     conectado, o `down` falha ao remover a rede, o `&&` impede o `up -d` e produção fica fora do ar.
   - Por isso o nginx alcança o HML pelo IP do host e portas publicadas (`10.0.0.126:3100` e `:4100`), não por
     nome de container.
2. **Qualquer alteração em `/home/digicam/nginx.conf` ou no compose de produção é aplicada sozinha na próxima hora
   cheia.** Um erro de sintaxe derruba produção nesse momento, então a validação prévia (Fase 6) é obrigatória.
3. **O MySQL de produção é o do próprio host** (8.0.46, `10.0.0.126:3306`). O banco tem ~290 MB
   (`Trafegos` 191 MB, `Saidas_nao_identificadas` 96 MB e ~587 mil linhas). Não há `sudo` sem senha, logo não há
   como criar outro schema/usuário nesse servidor sem a senha de root. Um MySQL em container resolve isso e isola
   carga e versão.
4. **As migrações não rodam pelo entrypoint.** O `entrypoint.sh` usa `envsubst`, que não existe na imagem; o
   `config.json` fica vazio e o `sequelize-cli db:migrate` falha a cada start (visível no log do backend de
   produção). O backend sobe mesmo assim porque lê as variáveis de ambiente direto.
   - A última migração aplicada em produção é `20220525140140`; a `20261006000000` (conciliação) é nova.
   - No estágio `production` do Dockerfile atual há ainda um segundo problema: `sequelize-cli` é devDependency e
     não é instalado.
   - Em HML a migração será um passo manual e explícito (Fase 4). Ver pendência P1.
5. **O frontend usa só caminhos relativos à raiz** (`/digicam`, `/images`, `createWebHistory()` sem base). A mesma
   imagem serve em qualquer host/porta, mas não em subcaminho (`/hml/`) sem mudar código. Por isso a separação é
   por porta.
6. **O backend grava fotos em `/digicam-fotos/` fixo no código** (`services/file.service.js`). Basta montar outra
   pasta do host nesse caminho.
7. **Câmeras e SFTP são acessados só para leitura** (consultas ISAPI, `list`/`get` no SFTP). O HML pode ler as
   mesmas câmeras sem tirar dados de produção ("modo sombra").
8. **O backend de produção está reiniciando sozinho** (23 reinícios em 55 min) por erro não tratado ao buscar foto
   inexistente no SFTP (`No such file ftp/fotos/.../undefined`). Não é causado por este plano, mas o HML em modo
   sombra tende a apresentar o mesmo comportamento. Ver pendência P2.
9. Recursos: 17 GB livres em disco (82% usado), 13 GB de RAM disponível, 12 CPUs. Estimativa de uso do HML:
   4 a 5 GB de disco (imagens, cache de build, MySQL, dump).

## 3. Arquitetura

```
                      navegador
            :80 ─────────┴───────── :8081
             │                        │
      ┌──────▼────────────────────────▼──────┐
      │   digicam_nginx_1 (nginx de produção) │
      └──┬──────────────┬─────────────────┬───┘
         │ rede digicam │                 │ via IP do host
   frontend:80     backend:4000     10.0.0.126:4100   10.0.0.126:3100
                        │                 │                 │
                        │          frontend-hml        backend-hml ◄── verificar_placas-hml
                        │          (serve /images)          │              (perfil "cameras")
                MySQL do host                          mysql-hml
                digicam_db :3306                  digicam_hml 127.0.0.1:3307
```

Decisões:

| Tema | Escolha | Motivo |
|---|---|---|
| Roteamento no nginx | novo bloco `server` em `listen 8081` | funciona por IP em qualquer estação; sem DNS; sem mudar o frontend |
| Ligação nginx → HML | IP do host + portas publicadas | não prende a rede de produção (item 2.1); com IP literal o nginx sobe mesmo com o HML parado (responde 502 só em :8081) |
| Banco | container `mysql:8.0` com volume nomeado | separado de verdade; não exige root do MySQL do host |
| Dados iniciais | cópia do banco de produção | valida a migração nova contra dados reais e mede o tempo dela |
| Fotos do HML | `/home/digicam/hml/fotos`, servidas pelo `frontend-hml` | não exige novo volume no nginx de produção nem `sudo` |
| Tags | `hml-<commit>` | nunca sobrescreve `latest` nem `backup` |

Alternativa sem mudar o compose de produção: separar por nome (`server_name hml.digicam.local` na porta 80). Só o
`nginx.conf` muda, mas cada estação de teste precisa de entrada no arquivo `hosts`.

## 4. Regras de segurança durante a execução

- Todo comando `docker-compose` do HML roda dentro de `projeto/src/homologacao` e com `-p digicam-hml`.
- Nunca usar: `--remove-orphans`, `docker system prune`, `docker image prune -a`, `docker network connect` na rede
  de produção, `docker build -t ...:latest`.
- Não executar nada em `/home/digicam` além dos passos da Fase 6.
- Não editar arquivos de produção entre os minutos :55 e :05 (janela do cron).
- `backend/tests/integracao` apaga dados: não rodar contra o banco do HML carregado com a cópia de produção.

## 5. Fases

### Fase 0 — Pré-checagens (sem impacto)

```bash
df -h /                      # precisa de pelo menos 8 GB livres
ss -ltn | grep -E ':(8081|3100|4100|3307)\b'   # deve sair vazio
```

Teste de rede: um container em outra rede bridge precisa alcançar uma porta publicada no IP do host. O teste usa
a porta 4000 de produção só como alvo de leitura e a imagem `nginx:alpine` que já existe na máquina.

```bash
docker network create hml-teste-rede
docker run --rm --pull never --network hml-teste-rede nginx:alpine \
  wget -q -T 5 -O /dev/null http://10.0.0.126:4000/ && echo REDE_OK
docker network rm hml-teste-rede
```

- `REDE_OK`: seguir o plano.
- Falha: usar o Plano B (seção 8) no lugar da Fase 6.

### Fase 1 — Arquivos do HML no repositório

Criar `homologacao/` (mesmo padrão de `producao_v1/`), com `docker-compose.yml`, `.env.example`, `nginx-hml.conf`
(trecho da Fase 6) e `README.md`. Adicionar `homologacao/.env` ao `.gitignore`.

`homologacao/.env` (não versionado):

```dotenv
COMPOSE_PROJECT_NAME=digicam-hml
HML_TAG=<commit curto>
HML_DB_PASS=<openssl rand -hex 16>
HML_DB_ROOT_PASS=<openssl rand -hex 16>
HML_JWT_KEY=<openssl rand -hex 16>
SFTP_PASS=<mesma de produção>
```

Senhas em hexadecimal de propósito: entram em URL de conexão na Fase 4 sem precisar de escape.
`HML_JWT_KEY` diferente de produção impede que um token de um ambiente valha no outro.

`homologacao/docker-compose.yml`:

```yaml
services:
  mysql:
    image: mysql:8.0
    environment:
      - TZ=America/Bahia
      - MYSQL_ROOT_PASSWORD=${HML_DB_ROOT_PASS}
      - MYSQL_DATABASE=digicam_hml
      - MYSQL_USER=digicam_hml
      - MYSQL_PASSWORD=${HML_DB_PASS}
    ports:
      - "127.0.0.1:3307:3306"
    volumes:
      - mysql_hml_data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -p$$MYSQL_ROOT_PASSWORD --silent"]
      interval: 10s
      timeout: 5s
      retries: 12
    mem_limit: 1g
    cpus: 2
    restart: unless-stopped
    logging: &log
      driver: "json-file"
      options: { max-size: "10m", max-file: "3" }

  backend:
    image: digicam-backend:hml-${HML_TAG}
    # o entrypoint da imagem tenta migrar e falha (item 2.4); a migração é feita na Fase 4
    entrypoint: ["npm", "start"]
    ports:
      - "10.0.0.126:3100:4000"
    volumes:
      - /home/digicam/hml/fotos:/digicam-fotos
    environment:
      - NODE_ENV=production
      - TZ=America/Bahia
      - JWT_KEY=${HML_JWT_KEY}
      - DATABASE_USER=digicam_hml
      - DATABASE_PASS=${HML_DB_PASS}
      - DATABASE_NAME=digicam_hml
      - DATABASE_HOST=mysql
      - DATABASE_DIALECT=mysql
      - SFTP_HOST=10.0.0.126
      - SFTP_PORT=22
      - SFTP_USER=digicamftp
      - SFTP_PASS=${SFTP_PASS}
    depends_on:
      mysql:
        condition: service_healthy
    mem_limit: 1g
    cpus: 2
    restart: unless-stopped
    logging: *log

  frontend:
    image: digicam-frontend:hml-${HML_TAG}
    ports:
      - "10.0.0.126:4100:80"
    volumes:
      # o nginx da imagem tem root /var/www, então /images/... sai desta pasta
      - /home/digicam/hml/fotos:/var/www/images:ro
    environment:
      - TZ=America/Bahia
    mem_limit: 256m
    restart: unless-stopped
    logging: *log

  verificar_placas:
    image: digicam-verificar-placas:hml-${HML_TAG}
    profiles: ["cameras"]          # só sobe com --profile cameras (Fase 7)
    environment:
      - NODE_ENV=production
      - TZ=America/Bahia
      - CRON_SCHEDULE=*/5 * * * * *
      - CLIENT_IDS=2
      - DIGICAM_BACKEND_URL=http://backend:4000
    depends_on:
      - backend
    mem_limit: 512m
    cpus: 1
    restart: unless-stopped
    logging: *log

volumes:
  mysql_hml_data:
```

Validar: `cd homologacao && docker-compose -p digicam-hml config -q`.

### Fase 2 — Build das imagens

```bash
cd /home/digicam/projeto/src
git status --short            # deve estar limpo
TAG=$(git rev-parse --short HEAD)

docker build --target production -t digicam-backend:hml-$TAG          ./backend
docker build --target production -t digicam-frontend:hml-$TAG         ./frontend
docker build --target production -t digicam-verificar-placas:hml-$TAG ./verificar-novas-placas

docker images | grep digicam  # latest e backup devem manter os IMAGE ID de antes
```

- `--target production` é necessário: o estágio `development` do backend faz `apt-get update` em Debian buster
  (fim de vida) e tende a falhar.
- O build precisa de internet (imagens base e npm).
- Gravar `HML_TAG=$TAG` no `homologacao/.env`.

### Fase 3 — Banco do HML

```bash
mkdir -p /home/digicam/hml/fotos /home/digicam/hml/dump
cd /home/digicam/projeto/src/homologacao
docker-compose -p digicam-hml up -d mysql
docker-compose -p digicam-hml ps          # aguardar "healthy"
```

Cópia de produção (só leitura; `--single-transaction` não bloqueia tabelas; fazer fora do horário de pico):

```bash
MYSQL_PWD='<senha de produção>' mysqldump -h 127.0.0.1 -u digicam_user \
  --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF digicam_db \
  | gzip > /home/digicam/hml/dump/digicam_db_$(date +%F).sql.gz

set -a; . ./.env; set +a
gunzip -c /home/digicam/hml/dump/digicam_db_*.sql.gz \
  | docker-compose -p digicam-hml exec -T mysql mysql -uroot -p"$HML_DB_ROOT_PASS" digicam_hml
```

Conferir: contagem de `Trafegos` e `Saidas_nao_identificadas` igual à de produção no momento do dump e
`SequelizeMeta` com 37 linhas.

### Fase 4 — Migração

Passo manual, com tempo medido (serve de ensaio para o deploy em produção):

```bash
time docker-compose -p digicam-hml run --rm --no-deps --entrypoint sh backend -c \
  'npx --yes sequelize-cli@6.3.0 db:migrate --url "mysql://$DATABASE_USER:$DATABASE_PASS@mysql:3306/$DATABASE_NAME"'
```

Conferir no banco do HML:

- `SequelizeMeta` com 38 linhas, a última `20261006000000-saidas-nao-identificadas-conciliacao.js`;
- `Saidas_nao_identificadas` com a coluna `status` e todos os registros antigos como `arquivada`;
- anotar a duração (a migração faz `ALTER TABLE` e dois `UPDATE` em ~587 mil linhas).

Ensaiar também o `db:migrate:undo` e migrar de novo, para ter o rollback testado.

### Fase 5 — Subir backend e frontend

```bash
docker-compose -p digicam-hml up -d            # sem o perfil "cameras"
docker-compose -p digicam-hml ps
curl -s http://10.0.0.126:3100/digicam/health
curl -s -o /dev/null -w '%{http_code}\n' http://10.0.0.126:4100/
docker-compose -p digicam-hml logs --tail=50 backend   # "Database connected", banco digicam_hml
```

Neste ponto o HML já está no ar, mas ainda sem o proxy: o frontend em `:4100` não alcança a API.

### Fase 6 — Publicar no nginx de produção (requer autorização explícita)

Altera `/home/digicam/nginx.conf` e `/home/digicam/docker-compose.yml`. Fazer logo após uma hora cheia (por
exemplo às :10), para ter folga até o próximo reinício.

1. Preparar cópias de trabalho, sem tocar nos originais:

   ```bash
   mkdir -p /home/digicam/hml/prod-novo
   cp -p /home/digicam/nginx.conf /home/digicam/docker-compose.yml /home/digicam/hml/prod-novo/
   ```

2. Em `prod-novo/nginx.conf`, acrescentar dentro de `http { }`, depois do `server` existente:

   ```nginx
       # ---- HOMOLOGAÇÃO ----
       server {
           listen 8081;
           server_name _;

           location / {
               proxy_pass http://10.0.0.126:4100;
               proxy_http_version 1.1;
               proxy_set_header Host $host;
               proxy_set_header X-Real-IP $remote_addr;
               proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
               proxy_set_header X-Forwarded-Proto $scheme;
           }

           location /digicam/ {
               proxy_pass http://10.0.0.126:3100/digicam/;
               proxy_http_version 1.1;
               proxy_set_header Host $host;
               proxy_set_header X-Real-IP $remote_addr;
               proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
               proxy_set_header X-Forwarded-Proto $scheme;
           }

           # fotos novas vêm do HML; as dos registros copiados de produção caem no acervo de produção (leitura)
           location /images/ {
               proxy_pass http://10.0.0.126:4100;
               proxy_intercept_errors on;
               error_page 404 = @fotos_producao;
           }
           location @fotos_producao {
               root /usr/share/nginx/html;
           }
       }
   ```

3. Em `prod-novo/docker-compose.yml`, no serviço `nginx`, acrescentar uma linha em `ports`:

   ```yaml
       ports:
         - "80:80"
         - "8081:8081"
   ```

4. Validar os dois arquivos **antes** de instalar:

   ```bash
   cd /home/digicam/hml/prod-novo
   docker run --rm --pull never \
     --add-host frontend:127.0.0.1 --add-host backend:127.0.0.1 \
     -v "$PWD/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:latest nginx -t
   docker-compose -f docker-compose.yml config -q && echo COMPOSE_OK
   diff /home/digicam/nginx.conf nginx.conf ; diff /home/digicam/docker-compose.yml docker-compose.yml
   ```

   Só prosseguir com `syntax is ok`, `COMPOSE_OK` e um diff contendo apenas o que foi acrescentado.

5. Backup e instalação:

   ```bash
   D=$(date +%Y%m%d-%H%M)
   cp -p /home/digicam/nginx.conf         /home/digicam/nginx.conf.bak-$D
   cp -p /home/digicam/docker-compose.yml /home/digicam/docker-compose.yml.bak-$D
   cp /home/digicam/hml/prod-novo/nginx.conf         /home/digicam/nginx.conf
   cp /home/digicam/hml/prod-novo/docker-compose.yml /home/digicam/docker-compose.yml
   ```

6. Aplicação: escolher uma das duas.
   - Esperar a próxima hora cheia (o cron recria os containers com a nova configuração); ou
   - executar `cd /home/digicam && ./reiniciar.sh` com alguém acompanhando (mesma interrupção de ~15 s do reinício
     horário).

7. Conferir logo após o reinício:

   ```bash
   docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
   curl -s -o /dev/null -w 'prod=%{http_code}\n' http://10.0.0.126/
   curl -s http://10.0.0.126/digicam/health
   curl -s -o /dev/null -w 'hml=%{http_code}\n'  http://10.0.0.126:8081/
   curl -s http://10.0.0.126:8081/digicam/health
   ```

   **Rollback** (se produção não responder): restaurar os dois `.bak-$D` e executar `./reiniciar.sh`.

8. Copiar os dois arquivos novos para `producao_v1/` (ou `producao_v2/`) e versionar.

### Fase 7 — Validação funcional e modo sombra

1. Abrir `http://10.0.0.126:8081/`, fazer login (usuários são os de produção, copiados no dump).
2. Conferir as abas da tela de entrada com os dados copiados: Em Travessia, Em Serviço / Visitantes, Histórico de
   Saídas, Saídas sem Entrada Identificada.
3. Ligar a leitura das câmeras:

   ```bash
   cd /home/digicam/projeto/src/homologacao
   docker-compose -p digicam-hml --profile cameras up -d
   docker-compose -p digicam-hml logs -f verificar_placas | grep 'Inserindo placa:'
   ```

   - O HML passa a receber as mesmas placas que produção e grava em `digicam_hml` e `/home/digicam/hml/fotos`.
   - Ações manuais feitas pelos porteiros em produção não chegam ao HML; a lista "Em Travessia" do HML cresce
     mais que a de produção. É esperado.
   - As câmeras passam a ser consultadas pelo dobro de clientes a cada 5 s. Acompanhar o log do
     `verificar_placas` de produção nos primeiros minutos; se aparecerem erros novos, desligar com
     `docker-compose -p digicam-hml stop verificar_placas`.
4. Testar o fluxo novo de ponta a ponta: saída sem entrada identificada aparecendo com foto, associação por
   arrastar e soltar, arquivamento, Registrar Saída.
5. Provar o isolamento, em produção:
   - `SELECT COUNT(*) FROM digicam_db.SequelizeMeta` continua 37;
   - `SHOW COLUMNS FROM digicam_db.Saidas_nao_identificadas LIKE 'status'` continua vazio;
   - `/digicam-fotos` não recebe arquivos vindos do HML;
   - `docker images` mostra `latest` e `backup` com os mesmos IMAGE ID.

## 6. Operação do HML

| Tarefa | Comando (em `homologacao/`) |
|---|---|
| Nova versão | build com nova tag (Fase 2), atualizar `HML_TAG`, migrar (Fase 4), `docker-compose -p digicam-hml up -d` |
| Logs | `docker-compose -p digicam-hml logs -f backend` |
| Parar tudo (mantém dados) | `docker-compose -p digicam-hml --profile cameras stop` |
| Recarregar o banco | parar backend, `DROP DATABASE`/`CREATE DATABASE digicam_hml`, repetir Fases 3 e 4 |
| Acesso ao banco | `mysql -h 127.0.0.1 -P 3307 -u digicam_hml -p digicam_hml` |
| Limpar cache de build | `docker builder prune` (não remove imagens) |

Acompanhar `df -h /` semanalmente enquanto o modo sombra estiver ligado.

## 7. Desmontagem

1. `docker-compose -p digicam-hml --profile cameras down -v` (remove containers, rede e volume **do HML**).
2. Reverter a Fase 6 com o mesmo procedimento (cópia, validação, backup, instalação, reinício).
3. Opcional: apagar `/home/digicam/hml` e as imagens `digicam-*:hml-*` (somente essas tags).

## 8. Plano B — nginx próprio do HML

Usar se o teste de rede da Fase 0 falhar, ou se a decisão for não tocar em nenhum arquivo de produção.

- Acrescentar ao compose do HML um serviço `nginx` (`nginx:latest`, já presente na máquina) publicando
  `8081:80`, com o mesmo bloco `server` da Fase 6 apontando para `frontend:80` e `backend:4000` pela rede do HML.
- Remover as portas `3100` e `4100` do host.
- A Fase 6 deixa de existir; o endereço de acesso continua `http://10.0.0.126:8081/`.
- Diferença para o usuário: as fotos dos registros antigos copiados de produção só aparecem se `/digicam-fotos`
  for montado como leitura nesse nginx.

## 9. Pendências fora do escopo deste plano

- **P1 — Migração no deploy de produção.** O entrypoint não migra (item 2.4). Antes de levar a branch para
  produção: corrigir o `entrypoint.sh` (gerar a configuração sem `envsubst`), mover `sequelize-cli` para
  `dependencies` e fazer o entrypoint parar se a migração falhar; ou assumir a migração como passo manual, como
  na Fase 4.
- **P2 — Backend reiniciando em produção.** Tratar o caso de foto não encontrada no SFTP
  (`logIdentificacao.controller.js`, chamada de `lerArquivo` com nome `undefined`). Vale corrigir na branch antes
  do modo sombra, para o HML não herdar o problema.
- **P3 — Backup.** O único dump de produção em disco é de mar/2024. O dump da Fase 3 passa a ser o mais recente;
  guardar uma cópia fora da máquina.
