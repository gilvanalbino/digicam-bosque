'use strict';

// Funções estatísticas puras do detector de anomalias: sem acesso a banco, relógio ou estado.

const ordenar = (valores) => [...valores].sort((a, b) => a - b);

/** Percentil (0 a 1) de uma amostra já ordenada, com interpolação linear. Amostra vazia: null. */
const percentilOrdenado = (ordenados, p) => {
  if (ordenados.length === 0) return null;
  const posicao = (ordenados.length - 1) * p;
  const abaixo = Math.floor(posicao);
  const acima = Math.ceil(posicao);
  return ordenados[abaixo] + (ordenados[acima] - ordenados[abaixo]) * (posicao - abaixo);
};

const percentil = (valores, p) => percentilOrdenado(ordenar(valores), p);

const mediana = (valores) => percentil(valores, 0.5);

/** Desvio absoluto mediano em torno de "centro" (padrão: a mediana da amostra). */
const mad = (valores, centro = mediana(valores)) => {
  if (valores.length === 0) return null;
  return mediana(valores.map((valor) => Math.abs(valor - centro)));
};

/** Desvio robusto: 0,6745 × (valor − mediana) / dispersão. A dispersão precisa ser positiva. */
const desvioRobusto = (valor, centro, dispersao) => (0.6745 * (valor - centro)) / dispersao;

const interpolar = (x, x0, x1, y0, y1) => y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);

const limitar = (valor) => Math.max(0, Math.min(100, valor));

/** Curva única de normalização: 0 até |z| = 2, 60 em |z| = 3, 100 em |z| = 6, linear entre os pontos. */
const normalizarDesvio = (z) => {
  const modulo = Math.abs(z);
  if (modulo <= 2) return 0;
  if (modulo <= 3) return interpolar(modulo, 2, 3, 0, 60);
  if (modulo <= 6) return interpolar(modulo, 3, 6, 60, 100);
  return 100;
};

/**
 * Pontuação pela cauda superior de uma distribuição de referência, quando não há desvio robusto:
 * 0 até o p95, 60 no p99, 100 no dobro do p99.
 */
const scorePorPercentis = (valor, p95, p99) => {
  if (p95 === null || p99 === null || valor <= p95) return 0;
  if (valor <= p99 && p99 > p95) return interpolar(valor, p95, p99, 0, 60);
  const teto = Math.max(p99 * 2, p99 + 1);
  if (valor >= teto) return 100;
  return interpolar(valor, p99, teto, 60, 100);
};

/** Pontuação pela raridade de uma faixa (probabilidade estimada): 0 a partir de 2%, 60 em 0,5%, 100 em 0%. */
const scoreRaridade = (probabilidade) => {
  if (probabilidade >= 0.02) return 0;
  if (probabilidade >= 0.005) return interpolar(probabilidade, 0.02, 0.005, 0, 60);
  return interpolar(Math.max(0, probabilidade), 0.005, 0, 60, 100);
};

/**
 * Probabilidade suavizada da faixa horária "hora" num histograma de 24 posições: as faixas vizinhas contam
 * pela metade e cada faixa recebe uma pseudo-observação, para amostras pequenas não zerarem a estimativa.
 */
const probabilidadeHora = (histograma, hora) => {
  const total = histograma.reduce((soma, n) => soma + n, 0);
  const vizinhas = histograma[(hora + 23) % 24] + histograma[(hora + 1) % 24];
  return (histograma[hora] + 0.5 * vizinhas + 1) / (2 * total + 24);
};

/**
 * EWMA para observações irregulares: o valor anterior decai pela metade a cada "meiaVidaDias" sem
 * observação antes de receber a nova. Sem valor anterior, a série começa do zero.
 */
const ewma = (anterior, observacao, lambda, diasDesdeAnterior = 0, meiaVidaDias = Infinity) => {
  const decaimento = meiaVidaDias === Infinity ? 1 : Math.pow(0.5, diasDesdeAnterior / meiaVidaDias);
  return lambda * observacao + (1 - lambda) * (anterior || 0) * decaimento;
};

/**
 * Score final (0 a 100): parte da dimensão mais anômala e sobe quando as outras concordam e quando há
 * mudança persistente. "dimensoes" traz só as dimensões calculadas (as ausentes não contam).
 *   principal = maior dimensão
 *   reforco   = média ponderada das demais
 *   S0        = principal + (100 − principal) × fatorReforco × reforco / 100
 *   S         = S0 + (100 − S0) × fatorPersistencia × persistencia / 100
 */
const comporScore = (dimensoes, persistencia, { pesos, fatorReforco, fatorPersistencia }) => {
  const nomes = Object.keys(dimensoes).filter((nome) => dimensoes[nome] !== null && dimensoes[nome] !== undefined);
  if (nomes.length === 0) {
    return { score: null, principal: null, reforco: 0, base: null };
  }
  const principal = nomes.reduce((maior, nome) => (dimensoes[nome] > dimensoes[maior] ? nome : maior), nomes[0]);
  const demais = nomes.filter((nome) => nome !== principal);
  const pesoTotal = demais.reduce((soma, nome) => soma + pesos[nome], 0);
  const reforco = pesoTotal > 0 ? demais.reduce((soma, nome) => soma + pesos[nome] * dimensoes[nome], 0) / pesoTotal : 0;
  const valorPrincipal = dimensoes[principal];
  const base = valorPrincipal + ((100 - valorPrincipal) * fatorReforco * reforco) / 100;
  const score = base + ((100 - base) * fatorPersistencia * (persistencia || 0)) / 100;
  return { score: limitar(score), principal, reforco, base };
};

const faixaDoScore = (score) => {
  if (score === null || score === undefined) return 'sem_dados';
  if (score >= 80) return 'prioridade_alta';
  if (score >= 60) return 'revisao';
  if (score >= 30) return 'observacao';
  return 'normal';
};

module.exports = {
  ordenar,
  percentil,
  percentilOrdenado,
  mediana,
  mad,
  desvioRobusto,
  normalizarDesvio,
  scorePorPercentis,
  scoreRaridade,
  probabilidadeHora,
  ewma,
  comporScore,
  faixaDoScore,
  limitar,
};
