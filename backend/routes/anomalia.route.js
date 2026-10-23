const BaseRoute = require('./base/baseRoute');

const anomaliaController = require('../controllers/anomalia.controller');
const Joi = require('joi');

const headers = Joi.object({
  authorization: Joi.string().required(),
}).unknown();

class AnomaliaRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  listar() {
    return {
      path: `/${this.context}/anomalias/client/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return await anomaliaController.listar(request.loggedUserId, request.params.id, request.query);
        },
        description: 'Lista os alertas de anomalia do cliente',
        notes: 'Filtros de período, faixa, status e placa, com paginação. Usuários do cliente.',
        tags: ['api', 'anomalias'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
          }),
          query: Joi.object({
            de: Joi.date().iso(),
            ate: Joi.date().iso(),
            faixa: Joi.string().valid('observacao', 'revisao', 'prioridade_alta'),
            status: Joi.string().valid('ABERTA', 'REVISADA', 'DESCARTADA', 'CONFIRMADA'),
            placa: Joi.string().max(10),
            ordem: Joi.string().valid('recente', 'score'),
            page: Joi.number().integer().min(1),
            pageSize: Joi.number().integer().min(1).max(200),
          }),
          headers,
        },
      },
    };
  }

  metricas() {
    return {
      path: `/${this.context}/anomalias/client/{id}/metricas`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return await anomaliaController.metricas(request.loggedUserId, request.params.id, request.query.dias);
        },
        description: 'Métricas do detector de anomalias',
        notes: 'Volume de alertas, revisões, atraso, qualidade dos dados e execuções do job',
        tags: ['api', 'anomalias'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
          }),
          query: Joi.object({
            dias: Joi.number().integer().min(1).max(90),
          }),
          headers,
        },
      },
    };
  }

  historicoDaPlaca() {
    return {
      path: `/${this.context}/anomalias/client/{id}/placa/{placa}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return await anomaliaController.historicoDaPlaca(request.loggedUserId, request.params.id, request.params.placa);
        },
        description: 'Histórico estatístico de uma placa no cliente',
        notes: 'Referências calculadas, alertas e últimos tráfegos da placa',
        tags: ['api', 'anomalias'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
            placa: Joi.string().max(10).required(),
          }),
          headers,
        },
      },
    };
  }

  sinaisDasPlacas() {
    const placas = Joi.array().items(Joi.string().max(10)).max(2000);
    return {
      path: `/${this.context}/anomalias/client/{id}/sinais`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          return await anomaliaController.sinaisDasPlacas(request.loggedUserId, request.params.id, request.payload);
        },
        description: 'Sinais dos cards de veículo',
        notes: 'Para cada placa: o alerta mais recente não descartado e, se pedida, a data da primeira passagem',
        tags: ['api', 'anomalias'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
          }),
          payload: Joi.object({
            placas: placas.default([]),
            primeira: placas.default([]),
          }),
          headers,
        },
      },
    };
  }

  obter() {
    return {
      path: `/${this.context}/anomalias/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return await anomaliaController.obter(request.loggedUserId, request.params.id);
        },
        description: 'Obtem um alerta de anomalia',
        notes: 'Alerta com evidências, revisões e o tráfego do evento',
        tags: ['api', 'anomalias'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
          }),
          headers,
        },
      },
    };
  }

  revisar() {
    return {
      path: `/${this.context}/anomalias/{id}/revisao`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await anomaliaController.revisar(request.loggedUserId, request.params.id, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Registra a revisão humana de um alerta de anomalia',
        notes: 'CONFIRMADA = relevância operacional confirmada; não significa confirmação de crime',
        tags: ['api', 'anomalias'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
          }),
          payload: Joi.object({
            resultado: Joi.string().valid('CONFIRMADA', 'DESCARTADA', 'REVISADA').required(),
            motivo: Joi.string().allow('', null).max(255),
          }),
          headers,
        },
      },
    };
  }
}

module.exports = AnomaliaRoutes;
