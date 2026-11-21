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

## Identificação por software

Serviço `identificacao_software` (código em `visao-placas/`, plano em `docs/plano_identificacao_placas_software.md`):
assiste ao vídeo das câmeras com a identificação por software **ligada no cadastro da câmera** e envia ao backend
a leitura e a passagem de cada veículo. O backend junta com a leitura da câmera em `Identificacoes` (uma linha por
passagem, com as duas placas) e, na divergência, usa a do software. No HML as 4 câmeras ficam ligadas.

```bash
cd ../visao-placas && docker build -t digicam-visao:hml-v<N> . && cd -    # nova versão; atualizar VISAO_TAG no .env
docker-compose -p digicam-hml --profile cameras up -d identificacao_software
docker-compose -p digicam-hml logs -f identificacao_software          # "status câmera N" a cada 5 min
```

- Ligar/desligar e desenhar a linha virtual: cadastro da câmera (administrador), ou `PUT /digicam/cameras/{id}/software`.
  O serviço relê a configuração a cada minuto.
- Números por câmera: menu "Rel. Identificação por software" (`GET /digicam/identificacoes/client/{id}/resumo`).
- `.env`: `VISAO_TAG` e o usuário de serviço `DIGICAM_SERVICO_EMAIL`/`DIGICAM_SERVICO_SENHA`.
- Fila de eventos em `/home/digicam/hml/identificacao-software` (o serviço reenvia o que não chegou ao backend).
- Limites: 5 CPUs e 4 GB. Com as 4 câmeras, ~3,5 CPUs. Uma conexão RTSP a mais por câmera (canal 101).
