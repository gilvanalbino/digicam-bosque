#!/bin/bash
echo "Rodando migrations"

# atualiza o arquivo confConexaoJobsDBAL.ini
cd /app/config

envsubst < config.json > config.tmp
rm config.json
mv config.tmp config.json

cat config.json

cd /app

npx sequelize-cli db:migrate

npm start

