# habilitar base de dados

- [x] Instalar e configurar Sequelize
- [x] Rodar mysql em docker
- [x] Criar database digicam_db / digicam123

# login

- [x] Criar tabela para controle de usuários da aplicação
      npx sequelize-cli model:generate --name User --attributes email:string, password:string, active:boolean
- [x] JWT autenticação
- [ ] Criptografar a senha do usuário no banco

# cliente

- [ ] CRUD Client
