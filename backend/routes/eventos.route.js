const Joi = require('joi');
const { PassThrough } = require('stream');
const BaseRoute = require('./base/baseRoute');
const eventos = require('../services/eventos.service');
const { User } = require('../models');

const PULSO_MS = 25 * 1000;

class EventosRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Avisos em tempo real (Server-Sent Events) das mudanças no tráfego e nas saídas sem entrada do cliente.
   * O navegador abre com `new EventSource('/digicam/eventos/client/{id}?token=...')`: o EventSource não envia
   * cabeçalhos, e o hapi-auth-jwt2 aceita o token pela URL.
   */
  stream() {
    return {
      path: `/${this.context}/eventos/client/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          const clientId = Number(request.params.id);
          const usuario = await User.findByPk(request.loggedUserId);
          if (!usuario || !(usuario.admin || usuario.client_id === clientId)) {
            return h.response().code(403);
          }
          const saida = new PassThrough();
          saida.write('retry: 5000\n\n');
          saida.write('event: conectado\ndata: {}\n\n');
          const cancelar = eventos.assinar(clientId, (tipo) => saida.write(`event: ${tipo}\ndata: {}\n\n`));
          // comentário periódico: mantém a conexão aberta nos proxies e detecta o navegador que fechou
          const pulso = setInterval(() => saida.write(': pulso\n\n'), PULSO_MS);
          const encerrar = () => {
            clearInterval(pulso);
            cancelar();
            saida.end();
          };
          request.raw.req.on('close', encerrar);
          request.raw.req.on('error', encerrar);
          return h
            .response(saida)
            .type('text/event-stream')
            .header('Cache-Control', 'no-cache, no-transform')
            .header('Connection', 'keep-alive')
            .header('X-Accel-Buffering', 'no')
            .header('Content-Encoding', 'identity');
        },
        description: 'Avisos em tempo real (SSE) de mudanças no tráfego e nas saídas sem entrada do cliente',
        tags: ['api', 'eventos'],
        timeout: { server: false, socket: false },
        validate: {
          params: Joi.object({ id: Joi.number().required() }),
          query: Joi.object({ token: Joi.string() }).unknown(),
        },
      },
    };
  }
}

module.exports = EventosRoutes;
