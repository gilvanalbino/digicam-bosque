const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const clientController = require('../controllers/client.controller');
const Joi = require('joi');

class ClientRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Rota para listagem de clientes
   */
  list() {
    return {
      path: `/${this.context}/clients`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return clientController.listClients(request.loggedUserId);
        },
        description: 'Obtem todos os clientes cadastrados',
        notes: 'Obtem a lista de todos os clientes cadastrados no sistema',
        tags: ['api', 'clientes'],
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

  get() {
    return {
      path: `/${this.context}/clients/{id}`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return clientController.getClient(request.loggedUserId, request.params.id);
        },
        description: 'Obtem um cliente pelo id',
        notes: 'Obtem um cliente cadastrado no sistema',
        tags: ['api', 'clientes'],
        validate: {
          params: Joi.object({
            id: Joi.number(),
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
      path: `/${this.context}/clients`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await clientController.insertClient(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Cria um cliente na base de dados',
        notes: 'Um cliente é criado na base de dados',
        tags: ['api', 'clientes'],
        validate: {
          payload: schemas.clientSchema,
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
      path: `/${this.context}/clients`,
      method: 'PUT',
      options: {
        handler: async (request, h) => {
          console.log('UPDATE CLIENTE');
          try {
            return await clientController.updateClient(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Atualiza um cliente na base de dados',
        notes: 'Um cliente é atualizado na base de dados',
        tags: ['api', 'clientes'],
        validate: {
          payload: schemas.clientSavedSchema,
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
      path: `/${this.context}/clients/{id}`,
      method: 'DELETE',
      options: {
        handler: async (request, h) => {
          try {
            return await clientController.removeClient(request.loggedUserId, request.params.id);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Remove um cliente da base de dados',
        notes: 'Um cliente é deletado da base de dados',
        tags: ['api', 'clientes'],
        validate: {
          params: Joi.object({
            id: Joi.number(),
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
}

module.exports = ClientRoutes;
