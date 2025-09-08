const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const portariaController = require('../controllers/portaria.controller');
const Joi = require('joi');

class PortariaRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Rota para listagem de portarias
   */
  list() {
    return {
      path: `/${this.context}/portarias`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return portariaController.listPortarias(request.loggedUserId);
        },
        description: 'Obtem todos as portarias cadastradas',
        notes: 'Obtem a lista de todas as portarias cadastrados no sistema',
        tags: ['api', 'portarias'],
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
      path: `/${this.context}/portarias/client/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return portariaController.listPortariasByClientId(request.loggedUserId, request.params.id);
        },
        description: 'Obtem todos as portarias cadastradas para o cliente informado',
        notes: 'Obtem a lista de todas as portarias cadastrados no sistema para o clientes informado',
        tags: ['api', 'portarias'],
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
      path: `/${this.context}/portarias/{id}`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return portariaController.getPortaria(request.loggedUserId, request.params.id);
        },
        description: 'Obtem uma portaria pelo id',
        notes: 'Obtem uma portaria cadastrada no sistema',
        tags: ['api', 'portarias'],
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
      path: `/${this.context}/portarias`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await portariaController.insertPortaria(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Cria uma portaria na base de dados',
        notes: 'Uma portaria é criada na base de dados',
        tags: ['api', 'portarias'],
        validate: {
          payload: schemas.portariaSchema,
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
      path: `/${this.context}/portarias`,
      method: 'PUT',
      options: {
        handler: async (request, h) => {
          try {
            return await portariaController.updatePortaria(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Atualiza uma portaria na base de dados',
        notes: 'Um portaria é atualizada na base de dados',
        tags: ['api', 'portarias'],
        validate: {
          payload: schemas.portariaSavedSchema,
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
      path: `/${this.context}/portarias/{id}`,
      method: 'DELETE',
      options: {
        handler: async (request, h) => {
          try {
            return await portariaController.removePortaria(request.loggedUserId, request.params.id);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Remove uma portaria da base de dados',
        notes: 'Uma portaria é deletada da base de dados',
        tags: ['api', 'portarias'],
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

module.exports = PortariaRoutes;
