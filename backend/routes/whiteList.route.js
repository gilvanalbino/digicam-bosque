const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const whiteListController = require('../controllers/whiteList.controller');
const Joi = require('joi');

class WhiteListRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Rota para listagem de whiteList
   */
  list() {
    return {
      path: `/${this.context}/whiteList`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return whiteListController.listWhiteList(request.loggedUserId);
        },
        description: 'Obtem todos as whiteList cadastradas',
        notes: 'Obtem a lista de todas as whiteList cadastrados no sistema',
        tags: ['api', 'whiteList'],
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
      path: `/${this.context}/whiteList/client/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return whiteListController.listWhiteListByClientId(request.loggedUserId, request.params.id, request.query);
        },
        description: 'Obtem todos as whiteList cadastradas para o cliente informado',
        notes: 'Obtem a lista de todas as whiteList cadastrados no sistema para o clientes informado',
        tags: ['api', 'whiteList'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
          }),
          query: Joi.object({
            texto: Joi.string().allow('').max(100).description('Filtra por placa, nome, marca ou modelo (contém)'),
            page: Joi.number().integer().min(1).description('Com este parâmetro, retorna { rows, total, page, pageSize }'),
            pageSize: Joi.number().integer().min(1).max(200),
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
      path: `/${this.context}/whiteList/{id}`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return whiteListController.getWhiteList(request.loggedUserId, request.params.id);
        },
        description: 'Obtem uma whiteList pelo id',
        notes: 'Obtem uma whiteList cadastrada no sistema',
        tags: ['api', 'whiteList'],
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
      path: `/${this.context}/whiteList`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await whiteListController.insertWhiteList(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Cria uma whiteList na base de dados',
        notes: 'Uma whiteList é criada na base de dados',
        tags: ['api', 'whiteList'],
        validate: {
          payload: schemas.whiteListSchema,
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

  importar() {
    return {
      path: `/${this.context}/whiteList/client/{id}/importar`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            const arquivo = request.payload ? request.payload.arquivo : null;
            return await whiteListController.importarWhiteList(request.loggedUserId, request.params.id, arquivo);
          } catch (error) {
            // o motivo (arquivo inválido, sem permissão) precisa chegar à tela
            console.error('Importação da green list: recusada -', error.message);
            return { status: 'ERROR', message: error.message };
          }
        },
        description: 'Importa veículos de uma planilha Excel para a whiteList do cliente',
        notes:
          'Planilha .xlsx no campo "arquivo" (multipart/form-data), com as colunas Placa, Marca, Modelo, Nome, Endereço, ' +
          'Número e Complemento, nesta ordem. Placa já cadastrada é atualizada. Retorna ' +
          '{ linhas_lidas, incluidos, atualizados, inalterados, erros: [{ linha, placa, motivo }] }.',
        tags: ['api', 'whiteList'],
        payload: {
          multipart: true,
          output: 'data',
          parse: true,
          allow: 'multipart/form-data',
          maxBytes: 5 * 1024 * 1024,
        },
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

  update() {
    return {
      path: `/${this.context}/whiteList`,
      method: 'PUT',
      options: {
        handler: async (request, h) => {
          try {
            return await whiteListController.updateWhiteList(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Atualiza uma whiteList na base de dados',
        notes: 'Um whiteList é atualizada na base de dados',
        tags: ['api', 'whiteList'],
        validate: {
          payload: schemas.whiteListSavedSchema,
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
      path: `/${this.context}/whiteList/{id}`,
      method: 'DELETE',
      options: {
        handler: async (request, h) => {
          try {
            return await whiteListController.removeWhiteList(request.loggedUserId, request.params.id);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Remove uma whiteList da base de dados',
        notes: 'Uma whiteList é deletada da base de dados',
        tags: ['api', 'whiteList'],
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

module.exports = WhiteListRoutes;
