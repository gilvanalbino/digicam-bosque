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
