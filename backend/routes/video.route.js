const { User, Camera } = require('../models');

// Vídeo ao vivo das câmeras: o nginx consulta esta rota (auth_request) antes de repassar o vídeo do go2rtc.
// O token vem no cabeçalho Authorization, que o nginx monta a partir do parâmetro "token" da URL do vídeo
// (o navegador não envia cabeçalhos em WebSocket). O fluxo se chama cam<id da câmera> (fluxo secundário, leve).
const FLUXO = /^cam(\d+)$/;

class VideoRoutes {
  constructor(context) {
    this.context = context;
  }

  static methods() {
    return ['cameras', 'autorizar'];
  }

  // câmeras que o usuário pode assistir, sem os dados de acesso (login/senha) que a listagem do cadastro devolve
  cameras() {
    return {
      method: 'GET',
      path: `/${this.context}/video/cameras/{clientId}`,
      options: {
        description: 'Lista as câmeras do cliente para o vídeo ao vivo',
        tags: ['api', 'video'],
        handler: async (request) => {
          const clientId = Number(request.params.clientId);
          const user = await User.findByPk(request.loggedUserId);
          if (!user || !(user.admin || user.client_id === clientId)) {
            return [];
          }
          return Camera.findAll({
            attributes: ['id', 'nome', 'sentido', 'portaria_id'],
            where: { client_id: clientId },
            order: [['nome', 'ASC']],
          });
        },
      },
    };
  }

  autorizar() {
    return {
      method: 'GET',
      path: `/${this.context}/video/autorizar`,
      options: {
        description: 'Autoriza o usuário logado a assistir ao vídeo ao vivo de uma câmera',
        tags: ['api', 'video'],
        // o onPreResponse do api.js transforma erros (Boom) em HTTP 200, que o nginx leria como "autorizado";
        // por isso a autenticação é verificada aqui e a recusa sai com o código HTTP explícito
        auth: { mode: 'try' },
        handler: async (request, h) => {
          if (!request.auth.isAuthenticated || !request.loggedUserId) {
            return h.response().code(401);
          }
          const fluxo = FLUXO.exec(String(request.query.src || ''));
          if (!fluxo) {
            return h.response().code(403);
          }
          const [user, camera] = await Promise.all([
            User.findByPk(request.loggedUserId),
            Camera.findByPk(Number(fluxo[1])),
          ]);
          // admin vê todas as câmeras; usuário de cliente só as do próprio cliente
          const permitido = user && camera && (user.admin || user.client_id === camera.client_id);
          return h.response().code(permitido ? 204 : 403);
        },
      },
    };
  }
}

module.exports = VideoRoutes;
