'use strict';

// Motor do detector de anomalias: referência do dia (perfis), avaliação de cada passagem e composição do
// score. Funções puras: recebem o índice montado em preparacao.js e os parâmetros, sem banco nem relógio.
const est = require('./estatistica');
const {
  DIA_MS,
  primeiroIndice,
  inicioDoDiaLocal,
  dataLocalIso,
  criarIndiceVizinhas,
  ehVizinhaDeFrequente,
} = require('./preparacao');

const HORA_MS = 3600 * 1000;
const SEMANAS_DE_REFERENCIA = 12;

const arredondar = (valor, casas = 1) => (valor === null || valor === undefined ? null : Number(valor.toFixed(casas)));

const resumirAmostra = (valores) => {
  const ordenados = est.ordenar(valores);
  const centro = est.percentilOrdenado(ordenados, 0.5);
  return {
    amostra: ordenados.length,
    mediana: centro,
    mad: ordenados.length ? est.mad(ordenados, centro) : null,
    p95: est.percentilOrdenado(ordenados, 0.95),
    p99: est.percentilOrdenado(ordenados, 0.99),
  };
};

/** Contagens de passagens por dia ativo, por hora ativa e por semana (blocos de 7 dias antes de "ate"). */
const contarPassagens = (passagens, inicio, fim, ate, desde, ignorarDia = null) => {
  const porDia = new Map();
  const porHora = new Map();
  const semanas = new Array(SEMANAS_DE_REFERENCIA).fill(0);
  for (let i = inicio; i < fim; i++) {
    const passagem = passagens[i];
    const semana = Math.floor((ate - passagem.t) / (7 * DIA_MS)) - 1;
    if (semana >= 0 && semana < SEMANAS_DE_REFERENCIA) semanas[semana]++;
    if (passagem.dia === ignorarDia) continue;
    porDia.set(passagem.dia, (porDia.get(passagem.dia) || 0) + 1);
    const hora = passagem.dia * 24 + passagem.hora;
    porHora.set(hora, (porHora.get(hora) || 0) + 1);
  }
  // só valem as semanas inteiras dentro da janela e depois da primeira passagem conhecida da placa
  const primeira = passagens.length ? Math.max(passagens[0].t, desde) : ate;
  const semanasValidas = semanas.filter((_, k) => ate - (k + 2) * 7 * DIA_MS >= primeira - 7 * DIA_MS && ate - (k + 2) * 7 * DIA_MS >= desde);
  return { dias: [...porDia.values()], horas: [...porHora.values()], semanas: semanasValidas };
};

const perfilDaPlaca = (qtdPassagens, duracoes, p) => {
  if (qtdPassagens === 0) return 'novo';
  if (qtdPassagens < p.MIN_PASSAGENS_PERFIL) return 'esporadico';
  if (duracoes.length < p.MIN_VIAGENS_INDIVIDUAL) return 'recorrente';
  const curtas = duracoes.filter((duracao) => duracao <= p.LIMITE_TRAVESSIA_S).length / duracoes.length;
  if (curtas >= p.PROPORCAO_PERFIL) return 'travessia_frequente';
  if (1 - curtas >= p.PROPORCAO_PERFIL) return 'permanencia';
  return 'misto';
};

/**
 * Referência válida para os eventos de um dia: perfil de cada placa e distribuição conjunta de cada perfil,
 * calculados só com o histórico anterior ao início do dia (janela de referência).
 */
const criarReferenciaDoDia = (indice, inicioDia, p) => {
  const desde = inicioDia - p.JANELA_REFERENCIA_DIAS * DIA_MS;
  const perfis = new Map();
  const acumulado = {};
  const individuais = [];
  const frequentes = [];

  for (const registro of indice.porPlaca.values()) {
    const inicio = primeiroIndice(registro.passagens, desde);
    const fim = primeiroIndice(registro.passagens, inicioDia);
    if (fim === inicio) continue;
    const duracoes = registro.viagens
      .slice(primeiroIndice(registro.viagens, desde, 'tSaida'), primeiroIndice(registro.viagens, inicioDia, 'tSaida'))
      .map((viagem) => viagem.duracao);
    const perfil = perfilDaPlaca(fim - inicio, duracoes, p);
    perfis.set(registro.chave, perfil);
    if (fim - inicio >= p.MIN_PASSAGENS_PERFIL) frequentes.push(registro.chave);

    const grupo = (acumulado[perfil] = acumulado[perfil] || {
      placas: 0, passagens: 0, duracoes: [], dias: [], horas: [], semanas: [],
      histograma: [new Array(24).fill(0), new Array(24).fill(0)],
    });
    grupo.placas++;
    grupo.passagens += fim - inicio;
    for (const duracao of duracoes) grupo.duracoes.push(duracao);
    const contagens = contarPassagens(registro.passagens, inicio, fim, inicioDia, desde);
    for (const n of contagens.dias) grupo.dias.push(n);
    for (const n of contagens.horas) grupo.horas.push(n);
    for (const n of contagens.semanas) grupo.semanas.push(n);
    for (let i = inicio; i < fim; i++) {
      grupo.histograma[registro.passagens[i].fds ? 1 : 0][registro.passagens[i].hora]++;
    }

    if (duracoes.length >= p.MIN_VIAGENS_INDIVIDUAL) {
      individuais.push({ chave: registro.chave, perfil, passagens: fim - inicio, duracao: resumirAmostra(duracoes) });
    }
  }

  const agregados = {};
  for (const [perfil, grupo] of Object.entries(acumulado)) {
    agregados[perfil] = {
      perfil,
      placas: grupo.placas,
      passagens: grupo.passagens,
      duracao: resumirAmostra(grupo.duracoes),
      dia: resumirAmostra(grupo.dias),
      hora: resumirAmostra(grupo.horas),
      semana: resumirAmostra(grupo.semanas),
      histograma: grupo.histograma,
    };
  }
  return {
    inicioDia,
    desde,
    perfis,
    agregados,
    individuais,
    vizinhas: criarIndiceVizinhas(frequentes),
  };
};

const estadoVazio = () => ({ ed: 0, tD: null, ef: 0, tF: null, fBase: 0, fBaseT: null, fDia: null, fMax: 0, dias: [] });

/** Atualiza o estado de mudança persistente (EWMA) da placa com as dimensões de um evento. */
const atualizarEstado = (anterior, evento, duracao, frequencia, p) => {
  let estado = anterior ? { ...anterior, dias: [...anterior.dias] } : estadoVazio();
  const ultima = Math.max(estado.tD || 0, estado.tF || 0);
  // um intervalo longo sem passagens reinicia a série
  if (ultima && (evento.t - ultima) / DIA_MS > p.REINICIO_EWMA_DIAS) estado = estadoVazio();

  if (duracao !== null) {
    const dias = estado.tD ? (evento.t - estado.tD) / DIA_MS : 0;
    estado.ed = est.ewma(estado.ed, duracao, p.LAMBDA, dias, p.MEIA_VIDA_EWMA_DIAS);
    estado.tD = evento.t;
  }
  if (frequencia !== null) {
    // a frequência conta uma vez por dia (o maior valor do dia), para várias passagens não inflarem a série
    if (estado.fDia !== evento.dia) {
      estado.fBase = estado.ef;
      estado.fBaseT = estado.tF;
      estado.fDia = evento.dia;
      estado.fMax = 0;
    }
    estado.fMax = Math.max(estado.fMax, frequencia);
    const dias = estado.fBaseT ? (evento.t - estado.fBaseT) / DIA_MS : 0;
    estado.ef = est.ewma(estado.fBase, estado.fMax, p.LAMBDA, dias, p.MEIA_VIDA_EWMA_DIAS);
    estado.tF = evento.t;
  }
  if (Math.max(duracao || 0, frequencia || 0) >= p.SCORE_MINIMO_DESVIO && !estado.dias.includes(evento.dia)) {
    estado.dias.push(evento.dia);
  }
  estado.dias = estado.dias.filter((dia) => evento.dia - dia <= p.REINICIO_EWMA_DIAS).slice(-10);
  const persistencia = estado.dias.length >= p.MIN_DIAS_PERSISTENCIA ? Math.max(estado.ed, estado.ef) : 0;
  return { estado, persistencia };
};

const avaliarDuracao = (evento, registro, desde, agregado, p) => {
  if (!evento.viagem) return null;
  const valor = evento.viagem.duracao;
  const anteriores = registro.viagens
    .slice(primeiroIndice(registro.viagens, desde, 'tSaida'), primeiroIndice(registro.viagens, evento.t, 'tSaida'))
    .filter((viagem) => viagem.trafegoId !== evento.viagem.trafegoId)
    .map((viagem) => viagem.duracao);

  if (anteriores.length >= p.MIN_VIAGENS_INDIVIDUAL) {
    const resumo = resumirAmostra(anteriores);
    const dispersao = Math.max(resumo.mad, p.DISPERSAO_MINIMA_FRACAO_MEDIANA * resumo.mediana, p.DISPERSAO_MINIMA_S);
    const z = est.desvioRobusto(valor, resumo.mediana, dispersao);
    return {
      score: est.normalizarDesvio(z),
      referencia: anteriores.length >= p.MIN_VIAGENS_CONFIAVEL ? 'individual' : 'preliminar',
      valor_s: Math.round(valor), mediana_s: Math.round(resumo.mediana), mad_s: Math.round(resumo.mad),
      dispersao_s: Math.round(dispersao), z: arredondar(z, 2), sentido: z >= 0 ? 'acima' : 'abaixo',
      amostra: anteriores.length, p95_s: Math.round(resumo.p95), p99_s: Math.round(resumo.p99),
    };
  }
  if (!agregado || agregado.duracao.amostra < p.MIN_VIAGENS_CONFIAVEL) {
    return { score: null, referencia: null, valor_s: Math.round(valor), amostra: anteriores.length };
  }
  const score = Math.min(est.scorePorPercentis(valor, agregado.duracao.p95, agregado.duracao.p99), p.TETO_SCORE_PERFIL.duracao);
  return {
    score, referencia: 'perfil', valor_s: Math.round(valor), mediana_s: Math.round(agregado.duracao.mediana),
    sentido: 'acima', amostra: anteriores.length, amostra_perfil: agregado.duracao.amostra,
    p95_s: Math.round(agregado.duracao.p95), p99_s: Math.round(agregado.duracao.p99),
  };
};

const avaliarFrequencia = (evento, registro, desde, agregado, p) => {
  const passagens = registro.passagens;
  const contarDesde = (limite) => evento.idx - primeiroIndice(passagens, limite + 1) + 1;
  const valores = {
    h1: contarDesde(evento.t - HORA_MS),
    h24: contarDesde(evento.t - DIA_MS),
    d7: contarDesde(evento.t - 7 * DIA_MS),
  };
  const historico = contarPassagens(passagens, primeiroIndice(passagens, desde), evento.idx, evento.t, desde, evento.dia);
  const janelas = {};
  const individual = historico.dias.length >= p.MIN_DIAS_ATIVOS_FREQUENCIA;

  const porDesvio = (nome, amostras, minimoAmostra, diferencaMinima, dispersaoMinima) => {
    if (amostras.length < minimoAmostra) {
      janelas[nome] = { valor: valores[nome], score: null };
      return;
    }
    const centro = est.mediana(amostras);
    const dispersao = Math.max(est.mad(amostras, centro), dispersaoMinima(centro));
    const z = est.desvioRobusto(valores[nome], centro, dispersao);
    const conta = valores[nome] - centro >= diferencaMinima;
    janelas[nome] = {
      valor: valores[nome], mediana: arredondar(centro), z: arredondar(z, 2), amostra: amostras.length,
      score: conta ? est.normalizarDesvio(z) : 0,
    };
  };
  const porPercentis = (nome, resumo, diferencaMinima) => {
    if (!resumo || resumo.amostra < p.MIN_VIAGENS_CONFIAVEL) {
      janelas[nome] = { valor: valores[nome], score: null };
      return;
    }
    const conta = valores[nome] - resumo.p95 >= diferencaMinima;
    janelas[nome] = {
      valor: valores[nome], p95: arredondar(resumo.p95), p99: arredondar(resumo.p99),
      score: conta ? Math.min(est.scorePorPercentis(valores[nome], resumo.p95, resumo.p99), p.TETO_SCORE_PERFIL.frequencia) : 0,
    };
  };

  if (individual) {
    // dispersão mínima de cada janela: a captura das câmeras é irregular e as contagens variam bastante
    porDesvio('h1', historico.horas, p.MIN_HORAS_ATIVAS_FREQUENCIA, p.DIFERENCA_MINIMA_1H, () => 1);
    porDesvio('h24', historico.dias, p.MIN_DIAS_ATIVOS_FREQUENCIA, p.DIFERENCA_MINIMA_24H, (centro) => Math.max(1.5, 0.5 * centro));
    porDesvio('d7', historico.semanas, p.MIN_SEMANAS_FREQUENCIA, p.DIFERENCA_MINIMA_7D, (centro) => Math.max(3, 0.5 * centro));
  } else {
    porPercentis('h1', agregado && agregado.hora, p.DIFERENCA_MINIMA_1H);
    porPercentis('h24', agregado && agregado.dia, p.DIFERENCA_MINIMA_24H);
    porPercentis('d7', agregado && agregado.semana, p.DIFERENCA_MINIMA_7D);
  }

  const calculadas = Object.keys(janelas).filter((nome) => janelas[nome].score !== null);
  if (calculadas.length === 0) return { score: null, referencia: null, janelas, amostra_dias: historico.dias.length };
  const principal = calculadas.reduce((maior, nome) => (janelas[nome].score > janelas[maior].score ? nome : maior), calculadas[0]);
  for (const nome of calculadas) janelas[nome].score = arredondar(janelas[nome].score);
  return {
    score: janelas[principal].score, referencia: individual ? 'individual' : 'perfil', principal, janelas,
    amostra_dias: historico.dias.length,
  };
};

const avaliarHorario = (evento, registro, desde, agregado, p) => {
  const tipo = evento.fds ? 1 : 0;
  const histograma = new Array(24).fill(0);
  let total = 0;
  for (let i = primeiroIndice(registro.passagens, desde); i < evento.idx; i++) {
    const passagem = registro.passagens[i];
    if ((passagem.fds ? 1 : 0) !== tipo || passagem.dia === evento.dia) continue;
    histograma[passagem.hora]++;
    total++;
  }
  const base = { hora: evento.hora, tipo_dia: evento.fds ? 'fim_de_semana' : 'dia_util' };
  if (total >= p.MIN_PASSAGENS_HORARIO) {
    const probabilidade = est.probabilidadeHora(histograma, evento.hora);
    return { ...base, score: est.scoreRaridade(probabilidade), referencia: 'individual', probabilidade: arredondar(probabilidade, 4), amostra: total, histograma };
  }
  const doPerfil = agregado && agregado.histograma[tipo];
  const totalPerfil = doPerfil ? doPerfil.reduce((soma, n) => soma + n, 0) : 0;
  if (totalPerfil < 10 * p.MIN_PASSAGENS_HORARIO) {
    return { ...base, score: null, referencia: null, amostra: total };
  }
  const probabilidade = est.probabilidadeHora(doPerfil, evento.hora);
  return {
    ...base, score: Math.min(est.scoreRaridade(probabilidade), p.TETO_SCORE_PERFIL.horario), referencia: 'perfil',
    probabilidade: arredondar(probabilidade, 4), amostra: total, amostra_perfil: totalPerfil, histograma: doPerfil,
  };
};

/**
 * Avalia uma passagem com o histórico anterior a ela. Retorna { ignorado } para provável erro de leitura,
 * ou as dimensões, o score, os motivos, as evidências e o novo estado de mudança persistente da placa.
 */
const avaliarEvento = (evento, registro, referencia, estadoAnterior, p) => {
  const desde = evento.t - p.JANELA_REFERENCIA_DIAS * DIA_MS;
  const anteriores = evento.idx - primeiroIndice(registro.passagens, desde);
  const perfil = referencia.perfis.get(evento.chave) || 'novo';

  // leitura isolada, a 1 caractere de uma placa frequente: provável erro de leitura, não é "placa nova"
  if (anteriores <= 1 && ehVizinhaDeFrequente(evento.chave, referencia.vizinhas)) {
    return { ignorado: 'provavel_erro_leitura' };
  }

  const agregado = referencia.agregados[perfil] || referencia.agregados.esporadico || null;
  const duracao = avaliarDuracao(evento, registro, desde, agregado, p);
  const frequencia = avaliarFrequencia(evento, registro, desde, agregado, p);
  const horario = avaliarHorario(evento, registro, desde, agregado, p);

  const dimensoes = {
    duracao: duracao ? duracao.score : null,
    frequencia: frequencia.score,
    horario: horario.score,
  };
  const { estado, persistencia } = atualizarEstado(estadoAnterior, evento, dimensoes.duracao, dimensoes.frequencia, p);
  const composicao = est.comporScore(dimensoes, persistencia, {
    pesos: p.PESOS, fatorReforco: p.FATOR_REFORCO, fatorPersistencia: p.FATOR_PERSISTENCIA,
  });

  const motivos = [];
  if (dimensoes.duracao >= p.SCORE_MINIMO_DESVIO) motivos.push(duracao.sentido === 'abaixo' ? 'DURACAO_ABAIXO' : 'DURACAO_ACIMA');
  if (dimensoes.frequencia >= p.SCORE_MINIMO_DESVIO) {
    motivos.push({ h1: 'FREQUENCIA_1H', h24: 'FREQUENCIA_24H', d7: 'FREQUENCIA_7D' }[frequencia.principal]);
  }
  if (dimensoes.horario >= p.SCORE_MINIMO_DESVIO) motivos.push('HORARIO_INCOMUM');
  if (persistencia >= p.SCORE_MINIMO_DESVIO) motivos.push('MUDANCA_PERSISTENTE');

  const referencias = { duracao: duracao ? duracao.referencia : null, frequencia: frequencia.referencia, horario: horario.referencia };
  return {
    estado,
    score: composicao.score,
    dimensoes,
    persistencia,
    motivos,
    qualidade: {
      perfil,
      referencias,
      historico_insuficiente: Object.values(referencias).every((tipo) => tipo !== 'individual' && tipo !== 'preliminar'),
      viagens_no_historico: duracao ? duracao.amostra : null,
      passagens_no_historico: anteriores,
      placa_saida_diferente: !!(evento.viagem && evento.viagem.placasDiferentes),
      situacao_viagem: evento.situacaoViagem || null,
      green_list: registro.greenList,
      red_list: registro.redList,
    },
    evidencias: {
      evento: {
        instante: new Date(evento.t).toISOString(), sentido: evento.sentido, portaria: evento.portaria || null,
        trafego_id: evento.trafegoId || null, saida_id: evento.saidaId || null, placa_lida: evento.placaLida || evento.chave,
      },
      // a rota é só informação nesta versão: não pontua
      rota: evento.viagem ? { portaria_entrada: evento.viagem.portariaEntrada, portaria_saida: evento.viagem.portariaSaida } : null,
      duracao,
      frequencia,
      horario,
      persistencia: {
        score: arredondar(persistencia), ewma_duracao: arredondar(estado.ed), ewma_frequencia: arredondar(estado.ef),
        dias_com_desvio: estado.dias.length,
      },
      composicao: {
        principal: composicao.principal, reforco: arredondar(composicao.reforco), base: arredondar(composicao.base),
        score: arredondar(composicao.score),
      },
    },
  };
};

/**
 * Avalia, em ordem cronológica, as passagens do índice entre "de" e "ate".
 *  - no máximo um alerta por placa e por dia (o evento de maior score), só a partir do score mínimo;
 *  - anomalia que persiste: se a placa já teve alerta com a mesma dimensão principal nos últimos dias e o
 *    score não subiu de forma relevante, o alerta anterior recebe a repetição em vez de nascer outro.
 * "estados" (Map placa -> estado) é atualizado no lugar. "recentes" traz os alertas já gravados do período de
 * carência ({ chave_veiculo, principal, dia, score, id }). "aoMudarDia" recebe a referência de cada dia.
 */
const processarPeriodo = (indice, de, ate, estados, p, { aoMudarDia = null, recentes = [] } = {}) => {
  const resumo = {
    eventos: 0, provavel_erro_leitura: 0, sem_dados: 0, normal: 0, observacao: 0, revisao: 0, prioridade_alta: 0,
    repetidos: 0,
  };
  const numeroDoDia = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DIA_MS);
  const ultimos = new Map();
  for (const recente of recentes) {
    const chave = `${recente.chave_veiculo}|${recente.principal}`;
    const atual = ultimos.get(chave);
    if (!atual || recente.dia > atual.dia) ultimos.set(chave, { ...recente, numero: numeroDoDia(recente.dia) });
  }

  const alertas = [];
  const repeticoes = [];
  let melhores = new Map();
  let referencia = null;
  let diaAtual = null;

  const fecharDia = () => {
    for (const resultado of melhores.values()) {
      const dia = dataLocalIso(resultado.evento.t);
      const chave = `${resultado.evento.chave}|${resultado.evidencias.composicao.principal}`;
      const anterior = ultimos.get(chave);
      const numero = numeroDoDia(dia);
      if (
        anterior && anterior.dia !== dia && numero - anterior.numero <= p.CARENCIA_REPETICAO_DIAS &&
        resultado.score < anterior.score + p.AUMENTO_PARA_NOVO_ALERTA
      ) {
        resumo.repetidos++;
        const repeticao = { dia, score: arredondar(resultado.score), ocorrido_em: new Date(resultado.evento.t).toISOString() };
        if (anterior.alerta) anterior.alerta.evidencias.repeticoes.push(repeticao);
        else repeticoes.push({ id: anterior.id, chave_veiculo: resultado.evento.chave, dia_original: anterior.dia, ...repeticao });
        continue;
      }
      const alerta = {
        chave_veiculo: resultado.evento.chave,
        dia,
        ocorrido_em: new Date(resultado.evento.t),
        trafego_id: resultado.evento.trafegoId || null,
        score: arredondar(resultado.score),
        score_duracao: arredondar(resultado.dimensoes.duracao),
        score_frequencia: arredondar(resultado.dimensoes.frequencia),
        score_horario: arredondar(resultado.dimensoes.horario),
        score_rota: null,
        score_persistencia: arredondar(resultado.persistencia),
        qualidade_dados: resultado.qualidade,
        motivos: resultado.motivos,
        evidencias: { ...resultado.evidencias, repeticoes: [] },
      };
      alertas.push(alerta);
      // repetição no mesmo dia de um alerta já gravado (execução incremental) não reinicia a carência
      if (!anterior || anterior.dia !== dia) {
        ultimos.set(chave, { dia, numero, score: alerta.score, alerta });
      }
    }
    melhores = new Map();
  };

  const eventos = indice.eventos;
  for (let i = primeiroIndice(eventos, de); i < eventos.length && eventos[i].t < ate; i++) {
    const evento = eventos[i];
    if (evento.dia !== diaAtual) {
      fecharDia();
      diaAtual = evento.dia;
      referencia = criarReferenciaDoDia(indice, inicioDoDiaLocal(evento.t), p);
      if (aoMudarDia) aoMudarDia(referencia);
    }
    resumo.eventos++;
    const resultado = avaliarEvento(evento, indice.porPlaca.get(evento.chave), referencia, estados.get(evento.chave), p);
    if (resultado.ignorado) {
      resumo[resultado.ignorado]++;
      continue;
    }
    estados.set(evento.chave, resultado.estado);
    if (resultado.score === null) {
      resumo.sem_dados++;
      continue;
    }
    resumo[est.faixaDoScore(resultado.score)]++;
    if (resultado.score < p.SCORE_MINIMO_ALERTA) continue;

    const anterior = melhores.get(evento.chave);
    const eventosNoDia = (anterior ? anterior.evidencias.eventos_no_dia : 0) + 1;
    const escolhido = !anterior || resultado.score > anterior.score ? { ...resultado, evento } : anterior;
    escolhido.evidencias.eventos_no_dia = eventosNoDia;
    melhores.set(evento.chave, escolhido);
  }
  fecharDia();

  return { alertas, repeticoes, resumo, referencia };
};

module.exports = {
  criarReferenciaDoDia,
  perfilDaPlaca,
  atualizarEstado,
  avaliarEvento,
  processarPeriodo,
  estadoVazio,
};
