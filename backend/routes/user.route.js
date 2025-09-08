const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const userController = require('../controllers/user.controller');
const Joi = require('joi');

class UserRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Rota para listagem dos usuárois
   */
  list() {
    return {
      path: `/${this.context}/users`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return userController.listUsers(request.loggedUserId);
        },
        description: 'Obtem todos os usuários cadastrados',
        notes: 'Obtem a lista de todos os usuários cadastrados no sistema',
        tags: ['api', 'users'],
        validate: {
          headers: Joi.object({
            authorization: Joi.string().required(),
          }).unknown(),
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }

  listByClientId() {
    return {
      path: `/${this.context}/users/client/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return userController.listUsersByClientId(request.loggedUserId, request.params.id);
        },
        description: 'Obtem todos os usuarios cadastrados para o cliente informado',
        notes: 'Obtem a lista de todas os usuarios cadastrados no sistema para o clientes informado',
        tags: ['api', 'users'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
          }),
          headers: Joi.object({
            authorization: Joi.string().required(),
          }).unknown(),
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }

  get() {
    return {
      path: `/${this.context}/users/{id}`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return userController.getUser(request.loggedUserId, request.params.id);
        },
        description: 'Obtem um usuário pelo id',
        notes: 'Obtem um usuário cadastrada no sistema',
        tags: ['api', 'users'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
          }),
          headers: Joi.object({
            authorization: Joi.string().required(),
          }).unknown(),
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }

  insert() {
    return {
      path: `/${this.context}/users`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            const usuario = await userController.insertUser(request.loggedUserId, request.payload);
            return usuario;
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Cria um usuário na base de dados',
        notes: 'Um usuário é criado na base de dados',
        tags: ['api', 'users'],
        validate: {
          payload: schemas.userSchema,
          headers: Joi.object({
            authorization: Joi.string().required(),
          }).unknown(),
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }

  update() {
    return {
      path: `/${this.context}/users`,
      method: 'PUT',
      options: {
        handler: async (request, h) => {
          try {
            const usuario = await userController.updateUser(request.loggedUserId, request.payload);
            return usuario;
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Atualiza um usuário na base de dados',
        notes: 'Um usuário é atualizado na base de dados',
        tags: ['api', 'users'],
        validate: {
          payload: schemas.userSavedSchema,
          headers: Joi.object({
            authorization: Joi.string().required(),
          }).unknown(),
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }

  delete() {
    return {
      path: `/${this.context}/users/{id}`,
      method: 'DELETE',
      options: {
        handler: async (request, h) => {
          try {
            const usuario = await userController.removeUser(request.loggedUserId, request.params.id);
            return usuario;
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Remove um usuário na base de dados',
        notes: 'Um usuário é deletado na base de dados',
        tags: ['api', 'users'],
        validate: {
          params: schemas.userIdSchema,
          headers: Joi.object({
            authorization: Joi.string().required(),
          }).unknown(),
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }
}

module.exports = UserRoutes;
