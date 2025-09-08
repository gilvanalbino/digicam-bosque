const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const blackListController = require('../controllers/blackList.controller');
const Joi = require('joi');

class BlackListRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Rota para listagem de blackList
   */
  list() {
    return {
      path: `/${this.context}/blackList`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return blackListController.listBlackList(request.loggedUserId);
        },
        description: 'Obtem todos as blackList cadastradas',
        notes: 'Obtem a lista de todas as blackList cadastrados no sistema',
        tags: ['api', 'blackList'],
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
      path: `/${this.context}/blackList/client/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return blackListController.listBlackListByClientId(request.loggedUserId, request.params.id);
        },
        description: 'Obtem todos as blackList cadastradas para o cliente informado',
        notes: 'Obtem a lista de todas as blackList cadastrados no sistema para o clientes informado',
        tags: ['api', 'blackList'],
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
      path: `/${this.context}/blackList/{id}`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return blackListController.getBlackList(request.loggedUserId, request.params.id);
        },
        description: 'Obtem uma blackList pelo id',
        notes: 'Obtem uma blackList cadastrada no sistema',
        tags: ['api', 'blackList'],
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
      path: `/${this.context}/blackList`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await blackListController.insertBlackList(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Cria uma blackList na base de dados',
        notes: 'Uma blackList é criada na base de dados',
        tags: ['api', 'blackList'],
        validate: {
          payload: schemas.blackListSchema,
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
      path: `/${this.context}/blackList`,
      method: 'PUT',
      options: {
        handler: async (request, h) => {
          try {
            return await blackListController.updateBlackList(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Atualiza uma blackList na base de dados',
        notes: 'Um blackList é atualizada na base de dados',
        tags: ['api', 'blackList'],
        validate: {
          payload: schemas.blackListSavedSchema,
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
      path: `/${this.context}/blackList/{id}`,
      method: 'DELETE',
      options: {
        handler: async (request, h) => {
          try {
            return await blackListController.removeBlackList(request.loggedUserId, request.params.id);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Remove uma blackList da base de dados',
        notes: 'Uma blackList é deletada da base de dados',
        tags: ['api', 'blackList'],
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

module.exports = BlackListRoutes;
