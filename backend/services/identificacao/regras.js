'use strict';
/**
 * Regras puras da conciliação entre a leitura da câmera e a do software
 * (docs/plano_identificacao_placas_software.md, seções 7.1 e 7.2). Sem acesso a banco, para serem testadas isoladas.
 */
const { diferencasPlacas } = require('../placaUtil');

// a câmera lê o veículo na chegada; o software registra quando ele aparece e quando cruza a linha, depois de a
// cancela abrir. A leitura da câmera vale de `inicio - TOLERANCIA` até `cruzamento + TOLERANCIA`.
const TOLERANCIA_MS = 20 * 1000;
// enquanto o software ainda não informou o cruzamento, a passagem é considerada aberta por até este tempo
const PASSAGEM_ABERTA_MS = 2 * 60 * 1000;
// tempo máximo de espera pela leitura do software quando a câmera chega primeiro (5 s decididos em 19/11, reduzidos
// para 2 s em 21/11 para a entrada aparecer mais rápido; se o software chegar depois, a correção tardia troca a placa
// no mesmo registro)
const ESPERA_SOFTWARE_MS = 2 * 1000;
// passagem vista pelo software sem leitura da câmera: espera este tempo depois do cruzamento antes de registrar a
// entrada ou a saída só pelo software (era 20 s). A câmera lê o veículo na chegada, antes de ele cruzar a linha, e a
// leitura chega ao backend em ~2,5 s; se ainda assim chegar depois, entra no mesmo registro (leitura_camera_tardia).
const ESPERA_CAMERA_APOS_PASSAGEM_MS = 5 * 1000;
// na divergência, o software só vence com a placa lida em pelo menos este número de quadros. Avaliação no HML em
// 21/11: os erros do software vinham de placas lidas em 1 ou 2 quadros (placa pequena, de longe); os acertos, de 9 a
// 13 quadros. A confiança do OCR não separa os dois casos (0,93 a 1,00 em todos).
const LEITURAS_MINIMAS_SOFTWARE = 3;

const FORMATO_PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

const normalizarPlaca = (texto) => String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const placaValida = (placa) => FORMATO_PLACA.test(placa || '');

// pares lidos de veículos diferentes: com fila na cancela, a leitura da câmera de um carro era juntada à passagem do
// software do carro de trás (avaliação de produção de 21 a 23/11: 3 a 6% dos pares, como LLY2442 e KPE8283). Duas
// placas no formato brasileiro com DIFERENCA_VEICULOS_DIFERENTES ou mais diferenças, sem contar as trocas típicas de
// OCR, são de veículos diferentes e não ficam no mesmo registro. Com 3 diferenças ainda há leituras ruins do mesmo
// veículo (XNZ14F9 e KNZ1400, KVQ2546 e KUC2548), por isso o corte em 4.
const DIFERENCA_VEICULOS_DIFERENTES = 4;
// caracteres que a câmera e o software confundem entre si (mais amplo que o da green list, que corrige placas)
const GRUPOS_PARECIDOS = ['I1LJ', 'O0DQU', 'B8', 'S5', 'Z2', 'G6', 'A4', 'T7'];
const GRUPO_PARECIDO = new Map(GRUPOS_PARECIDOS.flatMap((grupo, i) => [...grupo].map((c) => [c, i])));
const parecidos = (a, b) => a === b || (GRUPO_PARECIDO.has(a) && GRUPO_PARECIDO.get(a) === GRUPO_PARECIDO.get(b));

/** Distância de edição entre duas placas em que as trocas típicas de leitura (8/B, 0/O, 1/I...) não contam. */
const diferencasDeLeitura = (placaA = '', placaB = '') => {
  let anterior = Array.from({ length: placaB.length + 1 }, (_, j) => j);
  for (let i = 1; i <= placaA.length; i++) {
    const atual = [i];
    for (let j = 1; j <= placaB.length; j++) {
      const troca = anterior[j - 1] + (parecidos(placaA[i - 1], placaB[j - 1]) ? 0 : 1);
      atual[j] = Math.min(troca, anterior[j] + 1, atual[j - 1] + 1);
    }
    anterior = atual;
  }
  return anterior[placaB.length];
};

/**
 * As duas leituras são de veículos diferentes? Só quando as duas placas estão no formato brasileiro: uma leitura fora
 * do formato ("unknown", "BARRATO") não diz nada sobre o veículo, e o par continua valendo para o software corrigi-la.
 */
const veiculosDiferentes = (placaA, placaB) =>
  placaValida(placaA) && placaValida(placaB) && diferencasDeLeitura(placaA, placaB) >= DIFERENCA_VEICULOS_DIFERENTES;

const tempo = (valor) => (valor instanceof Date ? valor.getTime() : valor ? new Date(valor).getTime() : null);

/** Intervalo [início, fim] em que uma leitura da câmera pode ser desta passagem do software. */
const janelaSoftware = (identificacao, agora = Date.now()) => {
  const inicio = tempo(identificacao.instante_software_inicio);
  const cruzamento = tempo(identificacao.instante_software);
  const fim = cruzamento != null ? cruzamento : Math.max(inicio + PASSAGEM_ABERTA_MS, agora);
  return [inicio - TOLERANCIA_MS, fim + TOLERANCIA_MS];
};

/**
 * Entre as passagens do software ainda sem leitura da câmera, escolhe a da leitura da câmera (instante e placa).
 * Preferência: placa mais parecida e, no empate, chegada mais próxima do instante da câmera. Passagens com placa de
 * outro veículo (veiculosDiferentes) ficam de fora.
 */
const escolherSoftwareParaCamera = (candidatas, instanteCamera, placaCamera, agora = Date.now()) => {
  const t = tempo(instanteCamera);
  let melhor = null;
  for (const c of candidatas) {
    const [de, ate] = janelaSoftware(c, agora);
    if (t < de || t > ate) continue;
    if (veiculosDiferentes(c.placa_software, placaCamera)) continue;
    const dif = c.placa_software ? diferencasPlacas(c.placa_software, placaCamera) : 99;
    const dt = Math.abs(tempo(c.instante_software_inicio) - t);
    if (!melhor || dif < melhor.dif || (dif === melhor.dif && dt < melhor.dt)) melhor = { c, dif, dt };
  }
  return melhor ? melhor.c : null;
};

/**
 * Entre as identificações da câmera ainda sem leitura do software, escolhe a da passagem do software
 * (início, cruzamento opcional e placa). Mesma preferência de `escolherSoftwareParaCamera`.
 */
const escolherCameraParaSoftware = (candidatas, passagem, agora = Date.now()) => {
  const [de, ate] = janelaSoftware(passagem, agora);
  const inicio = tempo(passagem.instante_software_inicio);
  let melhor = null;
  for (const c of candidatas) {
    const t = tempo(c.instante_camera);
    if (t < de || t > ate) continue;
    if (veiculosDiferentes(passagem.placa_software, c.placa_camera)) continue;
    const dif = passagem.placa_software ? diferencasPlacas(passagem.placa_software, c.placa_camera) : 99;
    const dt = Math.abs(inicio - t);
    if (!melhor || dif < melhor.dif || (dif === melhor.dif && dt < melhor.dt)) melhor = { c, dif, dt };
  }
  return melhor ? melhor.c : null;
};

/**
 * Placa final de uma passagem (tabela 7.2). `placaCameraNaRedList`: a placa lida pela câmera está na red list e por
 * isso nunca é trocada. Na divergência o software vence se leu a placa em pelo menos LEITURAS_MINIMAS_SOFTWARE
 * quadros, ou se a placa da câmera está fora do formato brasileiro. `leiturasSoftware` ausente conta como suficiente.
 * Retorna { placa, fonte, divergente }. A correção pela green list é aplicada depois, fora daqui.
 */
const decidirPlaca = ({ placaCamera, placaSoftware, softwareLigado, placaCameraNaRedList = false, leiturasSoftware }) => {
  const temCamera = !!placaCamera;
  const temSoftware = !!placaSoftware;
  const divergente = temCamera && temSoftware && placaCamera !== placaSoftware;
  if (!softwareLigado || !temSoftware) {
    return { placa: temCamera ? placaCamera : null, fonte: temCamera ? 'camera' : null, divergente };
  }
  if (!temCamera) return { placa: placaSoftware, fonte: 'software', divergente: false };
  if (!divergente) return { placa: placaSoftware, fonte: 'camera', divergente: false };
  if (placaCameraNaRedList) return { placa: placaCamera, fonte: 'camera', divergente: true };
  const softwareFirme = leiturasSoftware == null || leiturasSoftware >= LEITURAS_MINIMAS_SOFTWARE;
  if (softwareFirme || !placaValida(placaCamera)) return { placa: placaSoftware, fonte: 'software', divergente: true };
  return { placa: placaCamera, fonte: 'camera', divergente: true };
};

// passagem do software que repete outra da mesma câmera: o rastreador perdeu o veículo (caixa mudando muito de
// tamanho perto da câmera) e abriu um rastro novo para ele. Caso real: SRO2I81 na Saída B2 em 21/11, dois rastros
// com 0,4 s de diferença, o segundo virou uma segunda saída sem entrada.
const JANELA_DUPLICATA_MS = 60 * 1000;

/**
 * Entre as outras identificações da mesma câmera, acha a que já representa este veículo: placa igual ou a 1
 * caractere (de qualquer leitura: câmera, software ou final) e horário a até JANELA_DUPLICATA_MS.
 */
const acharDuplicata = (passagem, outras) => {
  const t = tempo(passagem.instante_software_inicio);
  const placa = passagem.placa_software;
  if (!placa) return null;
  return (
    outras.find((o) => {
      if (o.id === passagem.id || o.situacao === 'descartada') return false;
      const to = tempo(o.instante_camera) ?? tempo(o.instante_software_inicio);
      if (to == null || Math.abs(to - t) > JANELA_DUPLICATA_MS) return false;
      return [o.placa_final, o.placa_camera, o.placa_software].some((p) => p && diferencasPlacas(p, placa) <= 1);
    }) || null
  );
};

// a câmera às vezes lê o mesmo veículo duas vezes em 1 ou 2 s, com 1 caractere diferente (caso real: TTB1894 e
// TTB1B94 na Saída B2 em 21/11, que viraram duas saídas sem entrada)
const JANELA_LEITURA_REPETIDA_MS = 10 * 1000;

/** Identificação da mesma câmera que esta leitura repete (placa igual ou a 1 caractere, até 10 s), ou null. */
const acharLeituraRepetida = (leitura, outras) => {
  const t = tempo(leitura.data);
  return (
    outras.find((o) => {
      if (o.situacao === 'descartada') return false;
      const to = tempo(o.instante_camera) ?? tempo(o.instante_software_inicio);
      if (to == null || Math.abs(to - t) > JANELA_LEITURA_REPETIDA_MS) return false;
      return [o.placa_camera, o.placa_software, o.placa_final].some((p) => p && diferencasPlacas(p, leitura.placa) <= 1);
    }) || null
  );
};

/** Direção que o software deve ver numa câmera de entrada (E) ou de saída (S). */
const direcaoEsperada = (sentidoCamera) => (sentidoCamera === 'S' ? 'saida' : 'entrada');

/** Entrada no histórico da identificação (7.4). */
const eventoHistorico = (tipo, dados = {}) => ({ tipo, instante: new Date().toISOString(), ...dados });

// ---------------- configuração do vídeo da câmera (seção 4)

const LARGURA_PADRAO = 1920;
const ALTURA_PADRAO = 1080;
const PADRAO_CONFIG = { canal: 101, qps: 5, linha: { ancora: 'centro', margem: 15 }, detector: { confianca: 0.25 } };

const ehPonto = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v));
const dentroDaImagem = (p, l, a) => p[0] >= 0 && p[1] >= 0 && p[0] <= l && p[1] <= a;

/** Distância com sinal do ponto à reta p1-p2 (positiva de um lado, negativa do outro). */
const distanciaLinha = (p1, p2, p) => {
  const comprimento = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  return ((p2[0] - p1[0]) * (p[1] - p1[1]) - (p2[1] - p1[1]) * (p[0] - p1[0])) / comprimento;
};

/**
 * Valida e completa a configuração desenhada no cadastro. Retorna { ok, erros, config }.
 * Coordenadas em pixels da imagem original da câmera.
 */
const validarConfigSoftware = (entrada) => {
  const erros = [];
  const cfg = JSON.parse(JSON.stringify(entrada || {}));
  const largura = Number(cfg.largura) || LARGURA_PADRAO;
  const altura = Number(cfg.altura) || ALTURA_PADRAO;
  const linha = { ...PADRAO_CONFIG.linha, ...(cfg.linha || {}) };
  const { p1, p2, ponto_dentro: dentro } = linha;
  if (!ehPonto(p1) || !ehPonto(p2) || !ehPonto(dentro)) {
    erros.push('Desenhe os dois pontos da linha e o ponto do lado de dentro');
  } else {
    if (![p1, p2, dentro].every((p) => dentroDaImagem(p, largura, altura))) erros.push('Pontos fora da imagem');
    if (Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) < 100) erros.push('Linha curta demais (mínimo de 100 pixels)');
    else if (Math.abs(distanciaLinha(p1, p2, dentro)) <= (Number(linha.margem) || 15) * 2) {
      erros.push('O ponto do lado de dentro está em cima da linha');
    }
  }
  if (!['centro', 'base'].includes(linha.ancora)) erros.push('Âncora inválida');
  let area = cfg.area || [];
  if (area.length) {
    if (area.length < 3 || !area.every(ehPonto)) erros.push('A área de interesse precisa de pelo menos 3 pontos');
    else if (!area.every((p) => dentroDaImagem(p, largura, altura))) erros.push('Área de interesse fora da imagem');
  } else {
    area = [];
  }
  const qps = Number(cfg.qps ?? PADRAO_CONFIG.qps);
  if (!(qps >= 1 && qps <= 15)) erros.push('Quadros por segundo entre 1 e 15');
  const confianca = Number((cfg.detector || {}).confianca ?? PADRAO_CONFIG.detector.confianca);
  if (!(confianca >= 0.1 && confianca <= 0.9)) erros.push('Confiança do detector entre 0,1 e 0,9');
  const config = {
    canal: Number(cfg.canal) || PADRAO_CONFIG.canal,
    largura,
    altura,
    qps,
    linha: { p1, p2, ponto_dentro: dentro, ancora: linha.ancora, margem: Number(linha.margem) || 15 },
    area,
    detector: { confianca },
  };
  return { ok: erros.length === 0, erros, config };
};

module.exports = {
  TOLERANCIA_MS,
  PASSAGEM_ABERTA_MS,
  ESPERA_SOFTWARE_MS,
  ESPERA_CAMERA_APOS_PASSAGEM_MS,
  LEITURAS_MINIMAS_SOFTWARE,
  DIFERENCA_VEICULOS_DIFERENTES,
  diferencasDeLeitura,
  veiculosDiferentes,
  normalizarPlaca,
  placaValida,
  janelaSoftware,
  escolherSoftwareParaCamera,
  escolherCameraParaSoftware,
  decidirPlaca,
  direcaoEsperada,
  acharDuplicata,
  JANELA_DUPLICATA_MS,
  acharLeituraRepetida,
  JANELA_LEITURA_REPETIDA_MS,
  eventoHistorico,
  validarConfigSoftware,
};
