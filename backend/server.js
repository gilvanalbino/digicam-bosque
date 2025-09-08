console.log('===============');
console.log('DigiCAM Backend');
console.log('===============\n');

// Se está rodando em ambiente de desenvolvimento, obtem as configurações do arquivo .env
console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
if (process.env.NODE_ENV == 'development') {
  console.log('lendo .env');
  require('dotenv').config();
}

const database = require('./database');
const bootstrap = require('./bootstrap');
const api = require('./api');

async function main() {
  await database();
  await bootstrap();
  await api();
}

main();
