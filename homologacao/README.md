# Homologação (HML)

Ambiente de homologação independente de produção: nginx, backend, frontend, leitor de placas, banco e fotos
próprios. Acesso em `http://10.0.0.126:8081/`. O plano completo está em `docs/plano_deploy_hml.md`.

Todo comando roda nesta pasta e com `-p digicam-hml`:

```bash
docker-compose -p digicam-hml ps
docker-compose -p digicam-hml logs -f backend
docker-compose -p digicam-hml up -d                      # sobe sem a leitura das câmeras
docker-compose -p digicam-hml --profile cameras up -d    # liga a leitura das câmeras (modo sombra)
docker-compose -p digicam-hml --profile cameras stop     # para tudo, mantendo os dados
```

- Configuração: copiar `.env.example` para `.env` e preencher.
- Dados: banco no volume `digicam-hml_mysql_hml_data`; fotos em `/home/digicam/hml/fotos`.
- A migração do banco é manual (Fase 4 do plano).
- Nunca usar `--remove-orphans` nem executar comandos em `/home/digicam`, onde fica produção.

## Protótipo de visão (Entrada B2)

Serviço `visao_b2` (código em `visao-placas/`): assiste ao vídeo principal da Entrada B2, registra cada veículo que
passa pela cancela com foto e, quando consegue, a placa, e compara com as entradas que a câmera registrou. Só lê o
banco do HML. Página em `http://10.0.0.126:8081/visao/` (entrar no sistema na mesma aba antes).

```bash
cd ../visao-placas && docker build -t digicam-visao:hml-v<N> . && cd -    # nova versão; atualizar VISAO_TAG no .env
docker-compose -p digicam-hml --profile visao up -d visao_b2              # liga
docker-compose -p digicam-hml --profile visao stop visao_b2               # desliga, mantendo os dados
docker-compose -p digicam-hml logs -f visao_b2
```

- `.env`: `VISAO_TAG` (tag da imagem) e `HML_DB_SENHA` (senha do usuário do banco do HML).
- Dados em `/home/digicam/hml/visao` (SQLite e fotos), limitados a 2 GB e 15 dias (`visao-placas/config.yaml`).
- Limites do container: 3 CPUs e 2 GB de memória. Usa uma conexão RTSP a mais na câmera 10.0.0.187.
