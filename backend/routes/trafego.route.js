const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const trafegoController = require('../controllers/trafego.controller');
const Joi = require('joi');

class TrafegoRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Rota para listagem de trafegos
   */
  list() {
    return {
      path: `/${this.context}/trafegos`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return trafegoController.listTrafegos(request.loggedUserId);
        },
        description: 'Obtem todos os trafegos cadastrados',
        notes: 'Obtem a lista de todos os trafegos cadastrados no sistema',
        tags: ['api', 'trafegos'],
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
      path: `/${this.context}/trafegos/client/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          if (request.query.status) {
            return trafegoController.listTrafegosByClientIdPorStatus(
              request.loggedUserId,
              request.params.id,
              request.query
            );
          }
          return trafegoController.listTrafegosByClientId(request.loggedUserId, request.params.id);
        },
        description: 'Obtem os trafegos do cliente informado',
        notes:
          'Sem "status", retorna todos os trafegos sem saída (array). Com "status" (travessia, servico, sem_saida, ' +
          'saidas), retorna { rows, total, page, pageSize } com os filtros e paginação informados.',
        tags: ['api', 'trafegos'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
          }),
          query: Joi.object({
            status: Joi.string().valid('travessia', 'servico', 'sem_saida', 'saidas'),
            placa: Joi.string().allow('').max(10),
            entradaDe: Joi.date().iso(),
            entradaAte: Joi.date().iso(),
            ordem: Joi.string().valid('saida_desc', 'saida_asc'),
            page: Joi.number().integer().min(1),
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

  listByClientIdRegistrosComSaida() {
    return {
      path: `/${this.context}/trafegos/client/{id}/registros-com-saida`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return trafegoController.listTrafegosByClientIdRegistrosComSaida(request.loggedUserId, request.params.id);
        },
        description: 'Obtem os trafegos com saídas cadastrados para o cliente informado',
        notes: 'Obtem os trafegos com saídas cadastrados para o cliente informado',
        tags: ['api', 'trafegos'],
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
      path: `/${this.context}/trafegos/{id}`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return trafegoController.getTrafego(request.loggedUserId, request.params.id);
        },
        description: 'Obtem uma trafego pelo id',
        notes: 'Obtem uma trafego cadastrada no sistema',
        tags: ['api', 'trafegos'],
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
      path: `/${this.context}/trafegos`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await trafegoController.insertTrafego(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Cria uma trafego na base de dados',
        notes: 'Um trafego é criado na base de dados',
        tags: ['api', 'trafegos'],
        validate: {
          payload: schemas.trafegoSchema,
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
      path: `/${this.context}/trafegos`,
      method: 'PUT',
      options: {
        handler: async (request, h) => {
          try {
            return await trafegoController.updateTrafego(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Atualiza um trafego na base de dados',
        notes: 'Um trafego é atualizado na base de dados',
        tags: ['api', 'trafegos'],
        validate: {
          payload: schemas.trafegoSavedSchema,
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
      path: `/${this.context}/trafegos/{id}`,
      method: 'DELETE',
      options: {
        handler: async (request, h) => {
          try {
            return await trafegoController.removeTrafego(request.loggedUserId, request.params.id);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Remove uma trafego da base de dados',
        notes: 'Um trafego é deletado da base de dados',
        tags: ['api', 'trafegos'],
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

  registrarSaidaManual() {
    return {
      path: `/${this.context}/trafegos/saidaManual/{id}/{portariaId}`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await trafegoController.registrarSaidaManual(
              request.loggedUserId,
              request.params.id,
              request.params.portariaId
            );
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Registra manualmente a saída do veículo',
        notes: 'Registra manualmente a saída do veículo',
        tags: ['api', 'trafegos'],
        validate: {
          params: Joi.object({
            id: Joi.number(),
            portariaId: Joi.number(),
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

module.exports = TrafegoRoutes;
