const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const moradorController = require('../controllers/morador.controller');
const Joi = require('joi');

class MoradorRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Rota para listagem de moradores
   */
  list() {
    return {
      path: `/${this.context}/moradores`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return moradorController.listMoradores(request.loggedUserId);
        },
        description: 'Obtem todos os moradores cadastrados',
        notes: 'Obtem a lista de todos as moradores cadastrados no sistema',
        tags: ['api', 'moradores'],
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
      path: `/${this.context}/moradores/client/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return moradorController.listMoradoresByClientId(request.loggedUserId, request.params.id);
        },
        description: 'Obtem todos os moradores cadastradas para o cliente informado',
        notes: 'Obtem a lista de todos os moradores cadastrados no sistema para o clientes informado',
        tags: ['api', 'moradores'],
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
      path: `/${this.context}/moradores/{id}`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return moradorController.getMorador(request.loggedUserId, request.params.id);
        },
        description: 'Obtem uma morador pelo id',
        notes: 'Obtem uma morador cadastrada no sistema',
        tags: ['api', 'moradores'],
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
      path: `/${this.context}/moradores`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await moradorController.insertMorador(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Cria uma morador na base de dados',
        notes: 'Uma morador é criada na base de dados',
        tags: ['api', 'moradores'],
        validate: {
          payload: schemas.moradorSchema,
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
      path: `/${this.context}/moradores`,
      method: 'PUT',
      options: {
        handler: async (request, h) => {
          try {
            return await moradorController.updateMorador(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Atualiza uma morador na base de dados',
        notes: 'Um morador é atualizada na base de dados',
        tags: ['api', 'moradores'],
        validate: {
          payload: schemas.moradorSavedSchema,
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
      path: `/${this.context}/moradores/{id}`,
      method: 'DELETE',
      options: {
        handler: async (request, h) => {
          try {
            return await moradorController.removeMorador(request.loggedUserId, request.params.id);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Remove uma morador da base de dados',
        notes: 'Uma morador é deletada da base de dados',
        tags: ['api', 'moradores'],
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

module.exports = MoradorRoutes;
