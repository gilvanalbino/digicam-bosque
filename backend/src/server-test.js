// 'use strict';

// const Hapi = require('@hapi/hapi');

console.log('=================');
console.log('DigiCAM - Backend');
console.log('=================\n');

// Se está rodando em ambiente de desenvolvimento, obtem as configurações do arquivo .env
if (process.env.NODE_ENV == 'dev') {
  require('dotenv').config();
}

const hikVisionService = require('../services/hikVision.service');

const main = async () => {
  // const server = Hapi.server({
  //   port: 3000,
  //   host: 'localhost',
  // });

  // await server.start();
  // console.log('Server running on %s', server.info.uri);

  const ret = await hikVisionService.getPhotoAsBase64();
  // console.log(JSON.stringify(ret));
  console.log('ret: ', ret);
};

main();

// const init = async () => {
//   const server = Hapi.server({
//     port: 3000,
//     host: 'localhost',
//   });

//   await server.start();
//   console.log('Server running on %s', server.info.uri);
// };

// process.on('unhandledRejection', (err) => {
//   console.log(err);
//   process.exit(1);
// });

// init();
