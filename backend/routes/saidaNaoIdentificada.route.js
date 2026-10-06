const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const saidaNaoIdentificadaController = require('../controllers/saidaNaoIdentificada.controller');
const Joi = require('joi');

const headers = Joi.object({
  authorization: Joi.string().required(),
}).unknown();

class SaidaNaoIdentificadaRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  listByClientId() {
    return {
      path: `/${this.context}/saidasNaoIdentificadas/client/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return await saidaNaoIdentificadaController.listarPorCliente(
            request.loggedUserId,
            request.params.id,
            request.query
          );
        },
        description: 'Obtem as saídas não identificadas do cliente',
        notes: 'Saídas cuja placa não foi associada automaticamente a uma entrada (padrão: somente pendentes)',
        tags: ['api', 'saidasNaoIdentificadas'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
          }),
          query: Joi.object({
            status: Joi.string().valid('pendente', 'associada', 'arquivada'),
            page: Joi.number().integer().min(1),
            pageSize: Joi.number().integer().min(1).max(200),
          }),
          headers,
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }

  arquivar() {
    return {
      path: `/${this.context}/saidasNaoIdentificadas/{id}/arquivar`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            const motivo = request.payload ? request.payload.motivo : null;
            return await saidaNaoIdentificadaController.arquivar(request.loggedUserId, request.params.id, motivo);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Arquiva uma saída não identificada',
        notes: 'Remove a saída da fila de pendências sem gerar registro de tráfego',
        tags: ['api', 'saidasNaoIdentificadas'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
          }),
          payload: Joi.object({
            motivo: Joi.string().allow('', null).max(255),
          }).allow(null),
          headers,
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }

  associar() {
    return {
      path: `/${this.context}/saidasNaoIdentificadas/{id}/associar/{trafegoId}`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await saidaNaoIdentificadaController.associar(
              request.loggedUserId,
              request.params.id,
              request.params.trafegoId
            );
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Associa uma saída não identificada a uma entrada',
        notes: 'Registra a saída no tráfego de entrada informado, como no casamento automático de placas',
        tags: ['api', 'saidasNaoIdentificadas'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
            trafegoId: Joi.number().required(),
          }),
          headers,
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }
}

module.exports = SaidaNaoIdentificadaRoutes;
