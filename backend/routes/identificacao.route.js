const Joi = require('joi');
const Boom = require('@hapi/boom');
const BaseRoute = require('./base/baseRoute');
const schemas = require('./schemas');
const identificacaoService = require('../services/identificacao/identificacao.service');
const { validarConfigSoftware } = require('../services/identificacao/regras');
const hikVisionService = require('../services/hikVision.service');
const { Camera, User } = require('../models');

const headers = Joi.object({ authorization: Joi.string().required() }).unknown();

// eventos do software (docs/plano_identificacao_placas_software.md, seção 6)
const eventoSoftware = {
  camera_id: Joi.number().integer().required(),
  rastro: Joi.string().max(64).required().description('id da passagem no software (idempotência)'),
  inicio: Joi.date().required().description('quando o veículo apareceu no vídeo'),
  placa: Joi.string().allow(null, '').max(10),
  confianca: Joi.number().min(0).max(1).allow(null),
  leituras: Joi.number().integer().min(0).allow(null),
  classe: Joi.string().max(12).allow(null, ''),
  foto: Joi.string().allow(null, '').description('JPEG em base64 (data URL)'),
  foto_placa: Joi.string().allow(null, ''),
};

const somenteAdmin = async (loggedUserId) => {
  const usuario = await User.findByPk(loggedUserId);
  if (!usuario || !usuario.admin) throw Boom.forbidden('Somente administrador');
  return usuario;
};

const podeVerCliente = async (loggedUserId, clientId) => {
  const usuario = await User.findByPk(loggedUserId);
  if (!usuario || !(usuario.admin || usuario.client_id === clientId)) throw Boom.forbidden('Operação não permitida');
};

class IdentificacaoRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  leituraSoftware() {
    return {
      path: `/${this.context}/identificacoesSoftware/leitura`,
      method: 'POST',
      options: {
        handler: async (request) => {
          await somenteAdmin(request.loggedUserId);
          return identificacaoService.registrarEventoSoftware(request.loggedUserId, request.payload, 'leitura');
        },
        description: 'Leitura de placa feita pelo software, ainda antes de o veículo cruzar a linha',
        tags: ['api', 'identificacoes'],
        payload: { maxBytes: 5 * 1024 * 1024 },
        validate: { headers, payload: Joi.object(eventoSoftware) },
      },
    };
  }

  passagemSoftware() {
    return {
      path: `/${this.context}/identificacoesSoftware/passagem`,
      method: 'POST',
      options: {
        handler: async (request) => {
          await somenteAdmin(request.loggedUserId);
          return identificacaoService.registrarEventoSoftware(request.loggedUserId, request.payload, 'passagem');
        },
        description: 'Veículo cruzou a linha virtual (ou saiu da imagem sem cruzar)',
        tags: ['api', 'identificacoes'],
        payload: { maxBytes: 5 * 1024 * 1024 },
        validate: {
          headers,
          payload: Joi.object({
            ...eventoSoftware,
            instante: Joi.date().required(),
            direcao: Joi.string().valid('entrada', 'saida', 'nenhuma').required(),
          }),
        },
      },
    };
  }

  camerasSoftware() {
    return {
      path: `/${this.context}/cameras/software`,
      method: 'GET',
      options: {
        handler: async (request) => {
          await somenteAdmin(request.loggedUserId);
          const cameras = await Camera.findAll({ where: { identificacao_software: true } });
          return cameras.map((c) => ({
            id: c.id, nome: c.nome, url: c.url, login: c.login, senha: c.senha, sentido: c.sentido,
            client_id: c.client_id, config_software: c.config_software,
          }));
        },
        description: 'Câmeras com a identificação por software ligada, com a configuração do vídeo (uso do serviço)',
        tags: ['api', 'identificacoes'],
        validate: { headers },
      },
    };
  }

  fotoCamera() {
    return {
      path: `/${this.context}/cameras/{id}/foto`,
      method: 'GET',
      options: {
        handler: async (request) => {
          await somenteAdmin(request.loggedUserId);
          const camera = await Camera.findByPk(request.params.id);
          if (!camera) throw Boom.notFound('Câmera não encontrada');
          const foto = await Promise.race([
            hikVisionService.obterFotoCamera(camera.url.includes(':') ? camera.url : `${camera.url}:80`, camera.login, camera.senha),
            new Promise((_, rej) => setTimeout(() => rej(Boom.gatewayTimeout('A câmera não respondeu')), 15000)),
          ]);
          return { foto };
        },
        description: 'Foto atual da câmera em resolução cheia, para desenhar a linha virtual no cadastro',
        tags: ['api', 'cameras'],
        validate: { headers, params: Joi.object({ id: Joi.number().required() }) },
      },
    };
  }

  salvarConfigSoftware() {
    return {
      path: `/${this.context}/cameras/{id}/software`,
      method: 'PUT',
      options: {
        handler: async (request) => {
          await somenteAdmin(request.loggedUserId);
          const camera = await Camera.findByPk(request.params.id);
          if (!camera) throw Boom.notFound('Câmera não encontrada');
          const { identificacao_software: ligado, config_software: config } = request.payload;
          let normalizada = camera.config_software;
          if (config) {
            const v = validarConfigSoftware(config);
            if (!v.ok) return { status: 'ERROR', message: v.erros.join('; ') };
            normalizada = v.config;
          }
          if (ligado && !normalizada) {
            return { status: 'ERROR', message: 'Desenhe a linha virtual antes de ligar a identificação por software' };
          }
          camera.identificacao_software = !!ligado;
          camera.config_software = normalizada;
          await camera.save();
          return { status: 'OK', identificacao_software: camera.identificacao_software, config_software: normalizada };
        },
        description: 'Liga/desliga a identificação por software da câmera e salva a linha virtual e a área',
        tags: ['api', 'cameras'],
        validate: {
          headers,
          params: Joi.object({ id: Joi.number().required() }),
          payload: Joi.object({
            identificacao_software: Joi.boolean().required(),
            config_software: Joi.object().unknown().allow(null),
          }),
        },
        response: { schema: schemas.response, failAction: 'log' },
      },
    };
  }

  resumo() {
    return {
      path: `/${this.context}/identificacoes/client/{id}/resumo`,
      method: 'GET',
      options: {
        handler: async (request) => {
          const clientId = Number(request.params.id);
          await podeVerCliente(request.loggedUserId, clientId);
          const fim = request.query.fim || new Date();
          const inicio = request.query.inicio || new Date(fim.getTime() - 24 * 3600 * 1000);
          return identificacaoService.resumo(clientId, inicio, fim, request.query.camera_id);
        },
        description: 'Quantas passagens cada solução identificou, divergências e correções, por câmera',
        tags: ['api', 'identificacoes'],
        validate: {
          headers,
          params: Joi.object({ id: Joi.number().required() }),
          query: Joi.object({ inicio: Joi.date(), fim: Joi.date(), camera_id: Joi.number() }),
        },
      },
    };
  }
}

module.exports = IdentificacaoRoutes;
