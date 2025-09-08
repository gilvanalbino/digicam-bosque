'use strict';

const Hapi = require('@hapi/hapi');
const { sequelize } = require('./models');

const LoginRoutes = require('./routes/login.route');
const UserRoutes = require('./routes/user.route');
const ClientRoutes = require('./routes/client.route');
const CameraRoutes = require('./routes/camera.route');
const TrafegoRoutes = require('./routes/trafego.route');
const MoradorRoutes = require('./routes/morador.route');
const CarroRoutes = require('./routes/carro.route');
const PortariaRoutes = require('./routes/portaria.route');
const LogIdentificacaoRoutes = require('./routes/logIdentificacao.route');
const RelatoriosRoutes = require('./routes/relatorios.route');
const WhiteListRoutes = require('./routes/whiteList.route');
const BlackListRoutes = require('./routes/blackList.route');

const HapiSwagger = require('hapi-swagger');
const Vision = require('@hapi/vision');
const Inert = require('@hapi/inert');

const { User } = require('./models');

const CONTEXT = 'digicam';

const init = async () => {
  // bring your own validation function
  const validate = async function (decoded, request, h) {
    try {
      const user = await User.findByPk(decoded.id);
      if (!user || !user.active) {
        return { isValid: false };
      } else {
        request.loggedUserId = user.id;
        return { isValid: true };
      }
    } catch (error) {
      console.log('Error: ', error);
      return { isValid: true };
    }
  };

  // inicializando o servidor REST
  const server = Hapi.server({
    port: 4000,
    host: '0.0.0.0',
    // host: 'localhost',
    routes: {
      cors: true,
    },
  });

  await server.register(require('hapi-auth-jwt2'));
  server.auth.strategy('jwt', 'jwt', {
    key: process.env.JWT_KEY,
    validate, // validate function defined above
    verifyOptions: { ignoreExpiration: true },
  });
  server.auth.default('jwt');

  function mapRoutes(instance, methods) {
    return methods.map((method) => instance[method]());
  }

  server.route([
    ...mapRoutes(new UserRoutes(CONTEXT), UserRoutes.methods()),
    ...mapRoutes(new LoginRoutes(CONTEXT), LoginRoutes.methods()),
    ...mapRoutes(new ClientRoutes(CONTEXT), ClientRoutes.methods()),
    ...mapRoutes(new CameraRoutes(CONTEXT), CameraRoutes.methods()),
    ...mapRoutes(new TrafegoRoutes(CONTEXT), TrafegoRoutes.methods()),
    ...mapRoutes(new MoradorRoutes(CONTEXT), MoradorRoutes.methods()),
    ...mapRoutes(new CarroRoutes(CONTEXT), CarroRoutes.methods()),
    ...mapRoutes(new PortariaRoutes(CONTEXT), PortariaRoutes.methods()),
    ...mapRoutes(new LogIdentificacaoRoutes(CONTEXT), LogIdentificacaoRoutes.methods()),
    ...mapRoutes(new RelatoriosRoutes(CONTEXT), RelatoriosRoutes.methods()),
    ...mapRoutes(new WhiteListRoutes(CONTEXT), WhiteListRoutes.methods()),
    ...mapRoutes(new BlackListRoutes(CONTEXT), WhiteListRoutes.methods()),
  ]);

  await server.register({
    plugin: require('hapi-dev-errors'),
    options: {
      showErrors: true, // process.env.NODE_ENV !== 'production',
    },
  });

  await server.register([
    require('@hapi/inert'),
    require('@hapi/vision'),
    {
      plugin: require('hapi-swagger'),
      options: {
        info: {
          title: 'DigiCAM Backend API',
          version: '1.0',
        },
        documentationPath: `/${CONTEXT}/docs`,
        grouping: 'tags',
      },
    },
    require('blipp'),
  ]);

  await sequelize.authenticate();
  console.log('Database connected');

  const preResponse = function (request, h) {
    const response = request.response;
    if (!response.isBoom) {
      return h.continue;
    }
    const error = response;
    console.log('Error: ', error);
    return JSON.stringify(error.output);
  };

  server.ext('onPreResponse', preResponse);

  await server.start();
  console.log(`Server running at: ${server.info.uri}`);

  return server;
};

module.exports = init;
