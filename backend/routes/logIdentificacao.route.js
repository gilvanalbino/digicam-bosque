const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const logIdentificacaoController = require('../controllers/logIdentificacao.controller');
const Joi = require('joi');

class LogIdentificacaoRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Rota para listagem de logIdentificacao
   */
  list() {
    return {
      path: `/${this.context}/logIdentificacao`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          console.log('antes');
          const ret = await logIdentificacaoController.listLogIdentificacao(request.loggedUserId);
          const ret2 = ret.map((l) => {
            return {
              id: l.id,
              camera_id: l.camera_id,
              placa: l.placa,
              picname: l.picname,
              sentido: l.sentido,
              data: l.data,
              imagem_placa: l.imagem_placa,
              imagem_carro: l.imagem_carro,
              imagem_pendente: l.imagem_pendente,
            };
          });

          return ret2;
        },
        description: 'Obtem lista de todos logIdentificação',
        notes: 'Obtem a lista de todos os logIdentificacao cadastrados no sistema',
        tags: ['api', 'logIdentificacao'],
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

  listByCameraId() {
    return {
      path: `/${this.context}/logIdentificacao/camera/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return await logIdentificacaoController.listLogIdentificacaoByCameraId(
            request.loggedUserId,
            request.params.id
          );
        },
        description: 'Obtem todos os logIdentificacao cadastradas para a camera informada',
        notes: 'Obtem a lista de todos os logIdentificacao cadastrados no sistema para a camera informada',
        tags: ['api', 'logIdentificacao'],
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

  listByPortariaId() {
    return {
      path: `/${this.context}/logIdentificacao/portaria/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return await logIdentificacaoController.listLogIdentificacaoByPortariaId(
            request.loggedUserId,
            request.params.id
          );
        },
        description: 'Obtem todos os logIdentificacao cadastradas para a portaria informada',
        notes: 'Obtem todos os logIdentificacao cadastradas para a portaria informada',
        tags: ['api', 'logIdentificacao'],
        validate: {
          params: Joi.object({
            id: Joi.number().required().description('Id da portaria'),
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

  downloadFotosLogIdentificacao() {
    return {
      path: `/${this.context}/logIdentificacao/download/{id}`,
      method: 'POST',
      options: {
        handler: (request, h) => {
          return logIdentificacaoController.downloadFotosLogIdentificacao(request.loggedUserId, request.params.id);
        },
        description: 'Solicita o download das imagens de uma placa identificada',
        notes: 'Solicita o download das imagens de uma placa identificada',
        tags: ['api', 'logIdentificacao'],
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

  getFotoCarroLogIdentificacao() {
    return {
      path: `/${this.context}/logIdentificacao/imagemCarro/{id}`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return logIdentificacaoController.getImagemCarro(request.params.id);
        },
        description: 'Obtém a foto do carro com a placa identificada',
        notes: 'Obtém a foto do carro com a placa identificada',
        tags: ['api', 'logIdentificacao'],
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
      path: `/${this.context}/logIdentificacao`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await logIdentificacaoController.insertLogIdentificacao(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Cria um logIdentificacao na base de dados',
        notes: 'Um logIdentificacao é criada na base de dados',
        tags: ['api', 'logIdentificacao'],
        validate: {
          payload: schemas.logIdentificacaoSchema,
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
      path: `/${this.context}/logIdentificacao/{id}`,
      method: 'DELETE',
      options: {
        handler: async (request, h) => {
          try {
            return await logIdentificacaoController.removeLogIdentificacao(request.loggedUserId, request.params.id);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Remove um logIdentificacao da base de dados',
        notes: 'Um logIdentificacao é deletado da base de dados',
        tags: ['api', 'logIdentificacao'],
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

  tentarRegistrarSaidaAutomatica() {
    return {
      path: `/${this.context}/logIdentificacao/saidaAutomatica/{id}`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await logIdentificacaoController.tentarRegistrarSaidaAutomatica(
              request.loggedUserId,
              request.params.id
            );
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Tenta realizar registro de saída do automóvel identificado automaticamente',
        notes: 'Tenta realizar registro de saída do automóvel identificado automaticamente',
        tags: ['api', 'logIdentificacao'],
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

module.exports = LogIdentificacaoRoutes;
