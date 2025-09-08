const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const relatoriosController = require('../controllers/relatorios.controller');
const Joi = require('joi');

class RelatoriosRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Relatório de listagem de trafego
   */
  relatorioListagemTrafegos() {
    return {
      path: `/${this.context}/relatorios/listagemTrafego/client/{id}`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          console.log('relatório: ', request.payload);
          return await relatoriosController.listagemTrafego(
            request.loggedUserId,
            request.params.id,
            request.payload.dataHoraInicio,
            request.payload.dataHoraFim,
            request.payload.portaria_entrada_id,
            request.payload.portaria_saida_id,
            request.payload.texto_placa_nome
          );
        },
        description: 'Relatório de listagem de tráfego',
        notes: 'Relatório de listagem de tráfego',
        tags: ['api', 'relatorios'],
        validate: {
          params: Joi.object({
            id: Joi.number().required().description('Id do cliente'),
          }),
          payload: Joi.object()
            .keys({
              dataHoraInicio: Joi.date().required().description('Data/hora inicio'),
              dataHoraFim: Joi.date().required().description('Data/hora fim'),
              portaria_entrada_id: Joi.number().optional().allow(null).description('Portaria de entrada'),
              portaria_saida_id: Joi.number().optional().allow(null).description('Portaria de saída'),
              texto_placa_nome: Joi.string().allow(null, '').optional().description('Filtro placa ou nome'),
            })
            .label('FiltroRelatorio'),
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

  /**
   * Relatório de listagem de trafego
   */
  relatorioListagemTrafegosExcel() {
    return {
      path: `/${this.context}/relatorios/listagemTrafego/client/{id}/excel`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          console.log('download excel: ', request.payload);
          return relatoriosController.listagemTrafegoExcel(
            request.loggedUserId,
            request.params.id,
            request.payload.dataHoraInicio,
            request.payload.dataHoraFim,
            request.payload.portaria_entrada_id,
            request.payload.portaria_saida_id,
            request.payload.texto_placa_nome
          );
        },
        description: 'Relatório de listagem de tráfego',
        notes: 'Relatório de listagem de tráfego',
        tags: ['api', 'relatorios'],
        validate: {
          params: Joi.object({
            id: Joi.number().required().description('Id do cliente'),
          }),
          payload: Joi.object()
            .keys({
              dataHoraInicio: Joi.date().required().description('Data/hora inicio'),
              dataHoraFim: Joi.date().required().description('Data/hora fim'),
              portaria_entrada_id: Joi.number().optional().allow(null).description('Portaria de entrada'),
              portaria_saida_id: Joi.number().optional().allow(null).description('Portaria de saída'),
              texto_placa_nome: Joi.string().allow(null, '').optional().description('Filtro placa ou nome'),
            })
            .label('FiltroRelatorio'),
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

module.exports = RelatoriosRoutes;
