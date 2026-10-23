// Vídeo ao vivo das câmeras pelo go2rtc: MSE sobre WebSocket em /video/ws, liberado pelo nginx depois de o backend
// conferir o login (rota /digicam/video/autorizar). O player é o do próprio go2rtc, carregado de /video/video-stream.js.
// Fluxo: cam<id da câmera>, o secundário da câmera (704x480, leve), usado no mosaico, no painel e na tela cheia.
import useLogin from './useLogin';
import { api } from '../utils/axios';

let player = null;
const carregarPlayer = () => {
  if (!player) {
    player = import(/* @vite-ignore */ `${location.origin}/video/video-stream.js`).catch((e) => {
      player = null;
      throw e;
    });
  }
  return player;
};

/**
 * Cria o player do fluxo dentro do elemento (substitui o conteúdo). Quando o elemento sai da página, o player
 * fecha a conexão sozinho; ao criar de novo, o vídeo volta ao vivo.
 * Com `interativo: false` o vídeo fica sem controles, não responde a clique, toque ou menu e não fica pausado.
 */
const montarVideo = async (el, fluxo, { interativo = true } = {}) => {
  await carregarPlayer();
  const video = document.createElement('video-stream');
  video.mode = 'mse';
  video.style.display = 'block';
  video.style.width = '100%';
  video.style.height = '100%';
  if (!interativo) {
    video.style.pointerEvents = 'none';
  }
  const token = encodeURIComponent(useLogin.state.auth.token || '');
  video.src = `/video/ws?src=${fluxo}&token=${token}`;
  el.replaceChildren(video);
  // o <video> interno é criado quando o player entra na página
  if (!interativo && video.video) {
    const v = video.video;
    v.controls = false;
    v.disablePictureInPicture = true;
    v.setAttribute('disablepictureinpicture', '');
    v.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback');
    // pausa por outros meios (teclas de mídia, controle de mídia do navegador): volta a tocar. Com a aba
    // escondida o próprio player desconecta e reconecta ao voltar, então não insiste.
    v.addEventListener('pause', () => {
      if (!document.hidden && video.isConnected) {
        v.play().catch(() => {});
      }
    });
  }
  return video;
};

// ordem de exibição: por bloco (B1, B2...) e, dentro do bloco, entrada antes de saída
const blocoDaCamera = (camera) => {
  const bloco = /B\s*(\d+)/i.exec(camera.nome || '');
  return bloco ? Number(bloco[1]) : 999;
};
const ordenarCameras = (cameras) =>
  [...cameras].sort(
    (a, b) =>
      blocoDaCamera(a) - blocoDaCamera(b) ||
      (a.sentido === b.sentido ? 0 : a.sentido === 'E' ? -1 : 1) ||
      (a.nome || '').localeCompare(b.nome || '')
  );

// nome curto para o rótulo: "Câmera Entrada B1" -> "Entrada B1"
const nomeCurto = (camera) => (camera.nome || '').replace(/^c[âa]mera\s+/i, '');

// câmeras de entrada e saída do cliente (sem dados de acesso), na ordem de exibição
const listarCamerasAoVivo = async (clientId) => {
  if (!clientId) {
    return [];
  }
  const { data } = await api.get(`/video/cameras/${clientId}`, {
    headers: { authorization: useLogin.state.auth.token },
  });
  return ordenarCameras((Array.isArray(data) ? data : []).filter((c) => c.sentido === 'E' || c.sentido === 'S'));
};

// acesso pelo endereço público (ex.: digicam.efabrika.com.br): o vídeo sai pela internet do condomínio e pelo
// túnel da AWS, que cobra pelo tráfego. Rede interna e túnel SSH (localhost) não contam.
const acessoPublico = (hostname = location.hostname) =>
  !(
    hostname === 'localhost' ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === '[::1]'
  );

export { carregarPlayer, montarVideo, ordenarCameras, nomeCurto, listarCamerasAoVivo, acessoPublico };
