# Obtendo imagem instanea da camera

http://digittocamera.ddns.net:5005/ISAPI/Streaming/channels/101/picture

# Obtendo placas identificadas

http://digittocamera.ddns.net:5005/ISAPI/Traffic/channels/101/vehicleDetect/plates

<?xml version="1.0" encoding="UTF-8"?>
<AfterTime version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<picTime>2021-11-05T14:30:00Z</picTime>
</AfterTime>

Auth

- Digest Auth (admin / digitt@2008)

# Rodando docker

    docker run -it --name mysql-digicam -e MYSQL_ROOT_PASSWORD=digicam123 -p 3306:3306 -d mysql --default-authentication-plugin=mysql_native_password

## Entrando no mysql

    docker start mysql-digicam
    docker exec -it mysql-digicam bash
    docker exec -it mysql-digicam mysql -uroot -pdigicam123

# Criando database

     CREATE DATABASE digicam_db;

     CREATE USER 'digicam_user'@'%' IDENTIFIED WITH mysql_native_password BY 'Digicam@123';

     GRANT ALL ON digicam_db.* TO 'digicam_user'@'%';

# Sequelize

## Criando model User

    npx sequelize-cli model:generate --name User --attributes email:string,password:string,active:boolean
     - atenção para valores dos atributes não deve ter vírgula

    npx sequelize-cli model:generate --name Client --attributes name:string,type:string,cep:string,address:string,number:string,district:string,city:string,state:string,active:boolean

    npx sequelize-cli model:generate --name Camera --attributes nome:string,url:string,modelo:string,sentido:string,client_id:number

    npx sequelize-cli model:generate --name Trafego --attributes placa:string,dataEntrada:date,dataSaida:date,destino:string,morador_destino_id:integer

    npx sequelize-cli model:generate --name Morador --attributes nome:string,endereco:string,observacao:string

    npx sequelize-cli model:generate --name Carro --attributes placa:string,modelo:string,cor:string,morador_id:integer

## Criando migration - https://sequelize.org/master/manual/migrations.html#migration-skeleton

    npx sequelize-cli migration:generate --name [nome_migration]

## Executando Migrations - https://sequelize.org/master/manual/migrations.html

    sequelize db:migrate

    sequelize db:migrate:undo

## Criar migration para atualização do modelo

    https://sequelize.org/master/manual/migrations.html#migration-skeleton

    npx sequelize-cli migration:generate --name [migration-name]

## Adicionar log / auditoria

https://github.com/ivmarcos/sequelize-version

## Acompanhamento

klogs digicam-verificar-novas-placas-6d5bdb9cfd-jnfs9 -f | grep 'Inserindo placa:'
klogs -f digicam-backend-74c7fc7575-vgb68 | grep "Encontrou entrada - registrou saida"
klogs digicam-backend-74c7fc7575-vgb68 -f | grep 'encontrou nenhuma entrada'
klogs digicam-backend-74c7fc7575-vgb68 -f | grep 'Inserindo placa'
