# Produção v1 — restauração do ambiente

Cópia dos arquivos de produção que ficam fora do repositório (snapshot de 2026-10-06).

| Arquivo | Origem na máquina |
|---|---|
| `docker-compose.yml` | `/home/digicam/docker-compose.yml` (o que realmente roda produção) |
| `nginx.conf` | `/home/digicam/nginx.conf` |
| `reiniciar.sh` | `/home/digicam/reiniciar.sh` |
| `crontab.txt` | `crontab -l` do usuário `digicam` |

## Restaurar

```bash
# 1. Build das imagens a partir do código do repo
docker build -t digicam-backend:latest ./backend
docker build -t digicam-frontend:latest ./frontend
docker build -t digicam-verificar-placas:latest ./verificar-novas-placas

# 2. Arquivos em /home/digicam
cp producao_v1/docker-compose.yml producao_v1/nginx.conf producao_v1/reiniciar.sh /home/digicam/
chmod +x /home/digicam/reiniciar.sh
crontab producao_v1/crontab.txt

# 3. Pasta de fotos
sudo mkdir -p /digicam-fotos && sudo chown digicam:digicam /digicam-fotos

# 4. Subir
cd /home/digicam && docker-compose up -d
```

## Não incluído (fazer backup à parte)

- **Banco MySQL** em `10.0.0.126` (`digicam_db`). Único dump local: `/home/digicam/backup.sql` (mar/2024, desatualizado).
- **Fotos** em `/digicam-fotos` (~11 GB).
