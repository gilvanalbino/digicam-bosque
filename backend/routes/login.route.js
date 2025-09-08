const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const { login } = require('../controllers/login.controller');
const Joi = require('joi');

class LoginRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Rota para listagem dos usuárois
   */
  login() {
    return {
      path: `/${this.context}/login`,
      method: 'POST',
      options: {
        auth: false,
        handler: (request, h) => {
          return login(request.payload, h);
        },
        description: 'Faz login para obter o token JWT',
        notes: 'Autenticação para geração do token JWR',
        tags: ['api', 'login'],
        validate: {
          payload: schemas.loginSchema,
        },
        response: {
          schema: schemas.loginResponseSchema,
          failAction: 'log',
        },
      },
    };
  }
}

module.exports = LoginRoutes;
