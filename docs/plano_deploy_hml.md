# Plano de deploy — ambiente de homologação (HML) independente de produção

Levantamento feito em 2026-10-10 na máquina `serverbosque` (10.0.0.126) e revisto em 2026-10-11.
Nada deste plano foi executado ainda.

## 1. Objetivo e resultado esperado

Subir, na mesma máquina que roda produção, uma segunda instância completa do sistema com o código da branch
`feature/abas-trafego-conciliacao`, **sem nenhum componente em comum com produção**: nginx, backend, frontend,
leitor de placas, banco, fotos, rede Docker e imagens são próprios do HML.

| | Produção (não muda) | Homologação (novo) |
|---|---|---|
| Acesso | `http://10.0.0.126/` | `http://10.0.0.126:8081/` |
| nginx | `digicam_nginx_1` | `nginx` próprio do HML |
| Projeto compose | `digicam` em `/home/digicam` | `digicam-hml` em `projeto/src/homologacao` |
| Rede Docker | `digicam_digicam_network` | `digicam-hml_default` |
| Imagens | `digicam-*:latest`, `digicam-backend:hotfix-20261011` | `digicam-*:hml-<commit>` |
| Banco | MySQL do host, `digicam_db` (porta 3306) | MySQL 8.0 em container, `digicam_hml` (127.0.0.1:3307) |
| Fotos | `/digicam-fotos` | `/home/digicam/hml/fotos` |
| Portas no host | 80, 3000, 4000 | 8081 e 127.0.0.1:3307 |
| Reinício horário (cron) | sim | não |

**Nenhum arquivo de produção é alterado e nenhum container de produção é reiniciado em nenhuma fase.**

### O que continua em comum, e por quê

| Ponto de contato | Natureza | Como evitar, se desejado |
|---|---|---|
| A máquina (CPU, memória, disco) | inevitável neste plano | limites de memória e CPU em todo container do HML |
| Cópia inicial do banco de produção | leitura única, na Fase 3 | começar com banco vazio (variante da Fase 3) |
| Câmeras e pasta de fotos do SFTP | fontes externas, só leitura, opcionais | não ligar o perfil `cameras` (Fase 6) |

Depois da Fase 3, o HML não lê nem escreve em nada que pertença a produção. Se produção for parada, atualizada
ou removida, o HML continua funcionando, e vice-versa.

## 2. O que o levantamento encontrou

Fatos que moldam o plano:

1. **Produção roda de `/home/digicam/docker-compose.yml`**, projeto `digicam`, e um cron executa
   `docker-compose down && docker-compose up -d` a cada hora cheia. O `down` remove a rede
   `digicam_digicam_network`.
   - Consequência: **nenhum container de HML pode ser ligado à rede de produção**. Com um container externo
     conectado, o `down` falha ao remover a rede, o `&&` impede o `up -d` e produção fica fora do ar.
   - O HML tem rede própria e nginx próprio; não há ligação entre as duas redes.
2. **O MySQL de produção é o do próprio host** (8.0.46, `10.0.0.126:3306`). O banco tem ~300 MB e a tabela
   `Trafegos` ~236 mil linhas. Criar outro schema nesse servidor manteria o HML dependente dele; um MySQL em
   container isola dados, carga e versão.
3. **As migrações não rodam pelo entrypoint.** O `entrypoint.sh` usa `envsubst`, que não existe na imagem; o
   `config.json` fica vazio e o `sequelize-cli db:migrate` falha a cada start. O backend sobe mesmo assim porque
   lê as variáveis de ambiente direto.
   - A última migração aplicada em produção é `20220525140140`; a `20261006000000` (conciliação) é nova.
   - No estágio `production` do Dockerfile atual há ainda um segundo problema: `sequelize-cli` é devDependency e
     não é instalado.
   - Em HML a migração é um passo manual e explícito (Fase 4). Ver pendência P1.
4. **O frontend usa só caminhos relativos à raiz** (`/digicam`, `/images`, `createWebHistory()` sem base). A mesma
   imagem serve em qualquer host/porta, mas não em subcaminho (`/hml/`) sem mudar código. Por isso o HML tem
   porta própria.
5. **O backend grava fotos em `/digicam-fotos/` fixo no código** (`services/file.service.js`). Basta montar outra
   pasta do host nesse caminho.
6. **Câmeras e SFTP são acessados só para leitura** (consultas ISAPI, `list`/`get` no SFTP). O HML pode ler as
   mesmas câmeras sem tirar dados de produção ("modo sombra").
7. **A queda do backend por foto não localizada no SFTP foi corrigida.** O hotfix está em produção desde
   2026-10-11 (`digicam-backend:hotfix-20261011`) e a correção já está na branch do HML (merge `d33596b`).
8. **A rota `/digicam/health` só existe a partir da `develop`.** O HML a tem; a imagem de produção responde
   HTTP 200 com corpo de "Not Found" nesse endereço, então ela não serve para comparar os dois ambientes.
9. Recursos em 2026-10-11: 43 GB livres em disco (55% usado), 13 GB de RAM disponível, 12 CPUs. Estimativa de uso
   do HML: 4 a 5 GB de disco (imagens, cache de build, MySQL, dump). A imagem `mysql:8.0` já está na máquina.

## 3. Arquitetura

```
              navegador                                    navegador
                 │ :80                                        │ :8081
      ┌──────────▼───────────┐                    ┌───────────▼───────────┐
      │  nginx (produção)    │                    │  nginx (HML)          │──► /home/digicam/hml/fotos
      └───┬──────────────┬───┘                    └───┬───────────────┬───┘
      frontend        backend ◄─ verificar        frontend         backend ◄─ verificar_placas
                         │        _placas                             │        (perfil "cameras")
                  MySQL do host                                   mysql (container)
                  digicam_db :3306                                digicam_hml 127.0.0.1:3307

        projeto "digicam"                               projeto "digicam-hml"
        rede digicam_digicam_network                    rede digicam-hml_default
        ──────────────── sem nenhuma ligação entre os dois lados ────────────────
```

Decisões:

| Tema | Escolha | Motivo |
|---|---|---|
| nginx | container próprio no compose do HML, porta 8081 | nenhum arquivo de produção muda; produção e HML podem cair ou reiniciar sem afetar um ao outro |
| Rede | rede padrão do projeto `digicam-hml` | não toca a rede de produção (item 2.1) |
| Banco | container `mysql:8.0` com volume nomeado | dados, carga e versão isolados |
| Dados iniciais | cópia única do banco de produção | valida a migração nova contra dados reais e mede o tempo dela |
| Fotos | `/home/digicam/hml/fotos`, servidas pelo nginx do HML | nada é lido de `/digicam-fotos` |
| Portas publicadas | só 8081 (acesso) e 127.0.0.1:3307 (banco) | backend e frontend do HML não ficam expostos direto |
| Tags | `hml-<commit>` | nunca sobrescreve `latest`, `backup` nem `hotfix-*` |

Consequência da independência das fotos: os registros copiados de produção apontam para arquivos que só existem
em `/digicam-fotos`, então aparecem **sem foto** no HML. As fotos novas, geradas no próprio HML, aparecem
normalmente. A Fase 3 traz uma cópia opcional das fotos recentes para quem precisar vê-las.

## 4. Regras de segurança durante a execução

- Todo comando `docker-compose` do HML roda dentro de `projeto/src/homologacao` e com `-p digicam-hml`.
- Nunca usar: `--remove-orphans`, `docker system prune`, `docker image prune -a`, `docker network connect` na rede
  de produção, `docker build -t ...:latest`.
- Não executar nada em `/home/digicam` (onde ficam o compose, o nginx.conf e o script de reinício de produção).
- `backend/tests/integracao` apaga dados: não rodar contra o banco do HML carregado com a cópia de produção.

## 5. Fases

### Fase 0 — Pré-checagens (sem impacto)

```bash
df -h /                                  # precisa de pelo menos 8 GB livres
ss -ltn | grep -E ':(8081|3307)\b'       # deve sair vazio
docker images | grep digicam             # anotar os IMAGE ID de produção para conferir no fim
```

### Fase 1 — Arquivos do HML no repositório

Criar `homologacao/` com `docker-compose.yml`, `nginx.conf`, `.env.example` e `README.md`. Adicionar
`homologacao/.env` ao `.gitignore`.

`homologacao/.env` (não versionado):

```dotenv
COMPOSE_PROJECT_NAME=digicam-hml
HML_TAG=<commit curto>
HML_DB_PASS=<openssl rand -hex 16>
HML_DB_ROOT_PASS=<openssl rand -hex 16>
HML_JWT_KEY=<openssl rand -hex 16>
SFTP_PASS=<senha do usuário digicamftp>
```

Senhas em hexadecimal de propósito: entram em URL de conexão na Fase 4 sem precisar de escape.
`HML_JWT_KEY` diferente de produção impede que um token de um ambiente valha no outro.

`homologacao/docker-compose.yml`:

```yaml
services:
  nginx:
    image: nginx:latest
    ports:
      - "8081:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /home/digicam/hml/fotos:/usr/share/nginx/html/images:ro
    environment:
      - TZ=America/Bahia
    depends_on:
      - frontend
      - backend
    mem_limit: 128m
    restart: unless-stopped
    logging: &log
      driver: "json-file"
      options: { max-size: "10m", max-file: "3" }

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
    logging: *log

  backend:
    image: digicam-backend:hml-${HML_TAG}
    # o entrypoint da imagem tenta migrar e falha (item 2.3); a migração é feita na Fase 4
    entrypoint: ["npm", "start"]
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
    environment:
      - TZ=America/Bahia
    mem_limit: 256m
    restart: unless-stopped
    logging: *log

  verificar_placas:
    image: digicam-verificar-placas:hml-${HML_TAG}
    profiles: ["cameras"]          # só sobe com --profile cameras (Fase 6)
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

`homologacao/nginx.conf` (arquivo próprio do HML; não é o de produção):

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    server {
        listen 80;
        server_name _;

        location / {
            proxy_pass http://frontend:80;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /digicam/ {
            proxy_pass http://backend:4000/digicam/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /images {
            root /usr/share/nginx/html;
        }
    }
}
```

Validar:

```bash
cd /home/digicam/projeto/src/homologacao
docker-compose -p digicam-hml config -q && echo COMPOSE_OK
docker run --rm --pull never \
  --add-host frontend:127.0.0.1 --add-host backend:127.0.0.1 \
  -v "$PWD/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:latest nginx -t
```

### Fase 2 — Build das imagens

```bash
cd /home/digicam/projeto/src
git status --short            # deve estar limpo
TAG=$(git rev-parse --short HEAD)

docker build --target production -t digicam-backend:hml-$TAG          ./backend
docker build --target production -t digicam-frontend:hml-$TAG         ./frontend
docker build --target production -t digicam-verificar-placas:hml-$TAG ./verificar-novas-placas

docker images | grep digicam  # as imagens de produção devem manter os IMAGE ID anotados na Fase 0
```

- `--target production` é necessário: o estágio `development` do backend faz `apt-get update` em Debian buster
  (fim de vida) e tende a falhar.
- O build precisa de internet (imagens base e npm).
- Gravar `HML_TAG=$TAG` no `homologacao/.env`.

### Fase 3 — Banco e fotos do HML

```bash
mkdir -p /home/digicam/hml/fotos /home/digicam/hml/dump
cd /home/digicam/projeto/src/homologacao
docker-compose -p digicam-hml up -d mysql
docker-compose -p digicam-hml ps          # aguardar "healthy"
```

Cópia única de produção. É o único momento em que o HML lê algo de produção; a leitura usa
`--single-transaction`, que não bloqueia tabelas. Fazer fora do horário de pico.

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

Depois da carga, trocar no banco do HML as senhas dos usuários que não devem ter o mesmo acesso nos dois
ambientes, se isso for relevante para os testadores.

**Variante sem nenhuma leitura de produção:** pular o dump e deixar a Fase 4 criar o esquema do zero (todas as
38 migrações em banco vazio). O backend cria os usuários administradores padrão na primeira subida; clientes,
portarias e câmeras precisam ser cadastrados pela tela. Perde-se o ensaio da migração sobre dados reais.

**Opcional — fotos dos registros copiados.** Para ver as fotos dos últimos dias no HML, copiar (não mover, não
montar) as pastas recentes:

```bash
mkdir -p /home/digicam/hml/fotos/2026/10
cp -a /digicam-fotos/2026/10/. /home/digicam/hml/fotos/2026/10/      # conferir o tamanho antes com du -sh
```

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

### Fase 5 — Subir o HML

```bash
docker-compose -p digicam-hml up -d            # sem o perfil "cameras"
docker-compose -p digicam-hml ps
curl -s http://10.0.0.126:8081/digicam/health
curl -s -o /dev/null -w '%{http_code}\n' http://10.0.0.126:8081/
docker-compose -p digicam-hml logs --tail=50 backend   # "Database connected", banco digicam_hml
```

O HML está no ar em `http://10.0.0.126:8081/`.

### Fase 6 — Validação funcional e modo sombra

1. Abrir `http://10.0.0.126:8081/` e fazer login.
2. Conferir as abas da tela de entrada com os dados copiados: Em Travessia, Em Serviço / Visitantes, Histórico de
   Saídas, Saídas sem Entrada Identificada.
3. Opcional — ligar a leitura das câmeras:

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
   - Sem esse perfil, o HML não fala com câmeras nem com o SFTP, e os testes usam só os dados copiados e
     lançamentos manuais.
4. Testar o fluxo novo de ponta a ponta: saída sem entrada identificada aparecendo com foto, associação por
   arrastar e soltar, arquivamento, Registrar Saída.

### Fase 7 — Prova de independência

Conferir, com o HML no ar:

| Verificação | Resultado esperado |
|---|---|
| `ls -l /home/digicam/docker-compose.yml /home/digicam/nginx.conf /home/digicam/reiniciar.sh` | datas de modificação anteriores ao início deste plano |
| `docker network inspect digicam_digicam_network` | só os quatro containers de produção |
| `docker network inspect digicam-hml_default` | só containers do HML |
| `docker images \| grep digicam` | imagens de produção com os IMAGE ID anotados na Fase 0 |
| `SELECT COUNT(*) FROM digicam_db.SequelizeMeta` (produção) | continua 37 |
| `SHOW COLUMNS FROM digicam_db.Saidas_nao_identificadas LIKE 'status'` (produção) | vazio |
| `find /digicam-fotos -newer /home/digicam/hml/dump -name '*saida-nao-ident*'` | vazio (esse nome só é gerado pela versão nova) |
| passar por uma hora cheia e ler o fim de `/home/digicam/reiniciar.log` | reinício de produção sem erro; HML não reinicia |
| `docker-compose -p digicam-hml stop` e abrir `http://10.0.0.126/` | produção responde normalmente com o HML parado |

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
2. Opcional: apagar `/home/digicam/hml` e as imagens `digicam-*:hml-*` (somente essas tags).

Não há nada a reverter em produção.

## 8. Pendências fora do escopo deste plano

- **P1 — Migração no deploy de produção.** O entrypoint não migra (item 2.3). Antes de levar a branch para
  produção: corrigir o `entrypoint.sh` (gerar a configuração sem `envsubst`), mover `sequelize-cli` para
  `dependencies` e fazer o entrypoint parar se a migração falhar; ou assumir a migração como passo manual, como
  na Fase 4.
- **P2 — Fotos de placas repetidas no dia.** O horário no nome do arquivo no SFTP não coincide com o horário da
  leitura (em uma leitura observada, 21:16:57 no arquivo e 21:18:35 na leitura). Quando a mesma placa tem mais
  de uma foto no dia, o filtro por minuto exato não escolhe nenhuma e o registro fica sem foto. Ajuste sugerido:
  escolher o arquivo de horário mais próximo. O modo sombra do HML é um bom lugar para validar.
- **P3 — Backup.** O único dump de produção em disco é de mar/2024. O dump da Fase 3 passa a ser o mais recente;
  guardar uma cópia fora da máquina.
- **P4 — `Dockerfile.hotfix`.** Veio para a branch no merge do hotfix e só serve para gerar a imagem do hotfix
  sobre a imagem antiga de produção; pode ser removido da branch nova.
