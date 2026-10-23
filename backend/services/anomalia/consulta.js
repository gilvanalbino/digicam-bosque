'use strict';

// Consultas e revisão dos alertas de anomalia, usadas pela API. Acessam os usuários do próprio cliente
// (operadores e administradores) e os administradores do sistema.
const { Op, QueryTypes } = require('sequelize');
const {
  sequelize, User, Trafego, SaidaNaoIdentificada, Camera, Anomalia, AnomaliaRevisao, AnomaliaReferencia, AnomaliaExecucao,
} = require('../../models');
const { normalizarPlaca, dataLocalIso } = require('./preparacao');
const { faixaDoScore } = require('./estatistica');

const SEM_PERMISSAO = { status: 'ERROR', message: 'Operação permitida somente para usuários do cliente' };
const FAIXAS = { observacao: [30, 60], revisao: [60, 80], prioridade_alta: [80, 101] };
const RESULTADOS = ['CONFIRMADA', 'DESCARTADA', 'REVISADA'];

const podeAcessar = async (loggedUserId, clientId) => {
  const usuario = await User.findByPk(loggedUserId);
  if (!usuario) {
    throw Error('Informar usuário logado');
  }
  return !!(usuario.admin || Number(usuario.client_id) === Number(clientId));
};

const comoObjeto = (valor) => (typeof valor === 'string' ? JSON.parse(valor) : valor);

const formatar = (anomalia, { resumido = false } = {}) => {
  const linha = anomalia.toJSON ? anomalia.toJSON() : anomalia;
  const evidencias = comoObjeto(linha.evidencias) || {};
  if (resumido && evidencias.horario) {
    // o histograma só interessa na tela de detalhe
    evidencias.horario = { ...evidencias.horario, histograma: undefined };
  }
  return {
    ...linha,
    placa: linha.chave_veiculo,
    faixa: faixaDoScore(linha.score),
    motivos: comoObjeto(linha.motivos) || [],
    qualidade_dados: comoObjeto(linha.qualidade_dados) || {},
    evidencias,
  };
};

/** Lista os alertas do cliente, com filtros de período, faixa, status e placa, e paginação. */
const listar = async (loggedUserId, clientId, { de, ate, faixa, status, placa, ordem, page = 1, pageSize = 50 } = {}) => {
  if (!(await podeAcessar(loggedUserId, clientId))) {
    return { rows: [], total: 0, page: 1, pageSize };
  }
  const where = { client_id: clientId };
  if (de || ate) {
    where.ocorrido_em = {};
    if (de) where.ocorrido_em[Op.gte] = de;
    if (ate) where.ocorrido_em[Op.lt] = ate;
  }
  if (faixa && FAIXAS[faixa]) where.score = { [Op.gte]: FAIXAS[faixa][0], [Op.lt]: FAIXAS[faixa][1] };
  if (status) where.status = status;
  if (placa) where.chave_veiculo = { [Op.like]: `%${normalizarPlaca(placa)}%` };
  const { rows, count } = await Anomalia.findAndCountAll({
    where,
    order: ordem === 'score' ? [['score', 'DESC'], ['ocorrido_em', 'DESC']] : [['ocorrido_em', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { rows: rows.map((anomalia) => formatar(anomalia, { resumido: true })), total: count, page, pageSize };
};

const CAMPOS_TRAFEGO = [
  'id', 'placa', 'placa_saida', 'dataEntrada', 'dataSaida', 'destino', 'portaria_entrada_id', 'portaria_saida_id',
  'identificador_placa_saida', 'imagem', 'imagem_thumb', 'imagem_placa', 'imagem_saida', 'imagem_saida_thumb',
  'imagem_saida_placa',
];

// saída lida pela câmera sem entrada identificada: é uma passagem do veículo, mas não tem linha em Trafegos
const CAMPOS_SAIDA = ['id', 'placa', 'data', 'status', 'imagem_carro', 'imagem_carro_thumb', 'imagem_placa'];
const CAMERA_DA_SAIDA = { model: Camera, attributes: ['id', 'portaria_id'] };

/** Alerta com as evidências, as revisões e o tráfego (ou a saída sem entrada) do evento. */
const obter = async (loggedUserId, id) => {
  const anomalia = await Anomalia.findByPk(id, {
    include: [{ model: AnomaliaRevisao, as: 'revisoes', include: [{ model: User, attributes: ['id', 'name'] }] }],
    order: [[{ model: AnomaliaRevisao, as: 'revisoes' }, 'revisado_em', 'DESC']],
  });
  if (!anomalia || !(await podeAcessar(loggedUserId, anomalia.client_id))) {
    return { status: 'ERROR', message: 'Alerta não encontrado' };
  }
  const trafego = anomalia.trafego_id ? await Trafego.findByPk(anomalia.trafego_id, { attributes: CAMPOS_TRAFEGO }) : null;
  // evento que é uma saída sem entrada identificada: não há tráfego, a foto está na própria saída
  const evento = (comoObjeto(anomalia.evidencias) || {}).evento || {};
  const saida =
    !trafego && evento.saida_id
      ? await SaidaNaoIdentificada.findOne({ attributes: CAMPOS_SAIDA, where: { id: evento.saida_id, client_id: anomalia.client_id }, include: [CAMERA_DA_SAIDA] })
      : null;
  return { status: 'OK', anomalia: formatar(anomalia), trafego, saida };
};

/**
 * Histórico estatístico de uma placa no cliente: referências, alertas, últimos tráfegos e últimas saídas sem
 * entrada identificada (há veículos que só aparecem nelas).
 */
const historicoDaPlaca = async (loggedUserId, clientId, placa) => {
  if (!(await podeAcessar(loggedUserId, clientId))) {
    return { placa: normalizarPlaca(placa), referencias: [], alertas: [], trafegos: [], saidas: [] };
  }
  const chave = normalizarPlaca(placa);
  const referencias = await AnomaliaReferencia.findAll({
    attributes: ['perfil', 'janela_inicio', 'janela_fim', 'qtd_viagens', 'qtd_passagens', 'duracao_mediana', 'duracao_mad',
      'duracao_p95', 'duracao_p99', 'versao_modelo', 'calculado_em'],
    where: { client_id: clientId, chave_veiculo: chave },
    order: [['janela_fim', 'DESC']],
    limit: 30,
  });
  const alertas = await Anomalia.findAll({
    where: { client_id: clientId, chave_veiculo: chave },
    order: [['ocorrido_em', 'DESC']],
    limit: 50,
  });
  const trafegos = await Trafego.findAll({
    attributes: CAMPOS_TRAFEGO,
    where: { client_id: clientId, placa: chave },
    order: [['dataEntrada', 'DESC']],
    limit: 30,
  });
  const saidas = await SaidaNaoIdentificada.findAll({
    attributes: CAMPOS_SAIDA,
    where: { client_id: clientId, placa: chave, status: { [Op.in]: ['pendente', 'arquivada'] } },
    include: [CAMERA_DA_SAIDA],
    order: [['data', 'DESC']],
    limit: 30,
  });
  return { placa: chave, referencias, alertas: alertas.map((alerta) => formatar(alerta, { resumido: true })), trafegos, saidas };
};

const iso = (data) => (data ? new Date(data).toISOString() : null);

/**
 * Sinais exibidos nos cards de veículo, por placa:
 *  - anomalia: o alerta mais recente da placa que não foi descartado na revisão (ou null);
 *  - primeira_passagem: data da leitura mais antiga da placa no cliente, entrada ou saída. Só é calculada para
 *    as placas pedidas em "primeira": ela não muda depois de conhecida, então a tela pede uma vez só.
 */
const sinaisDasPlacas = async (loggedUserId, clientId, { placas = [], primeira = [] } = {}) => {
  if (!(await podeAcessar(loggedUserId, clientId))) {
    return { status: 'ERROR', message: SEM_PERMISSAO.message };
  }
  const chaves = (lista) => [...new Set(lista.map(normalizarPlaca).filter(Boolean))];
  const sinais = {};
  const sinal = (placa) => (sinais[placa] = sinais[placa] || { anomalia: null });

  const pedidas = chaves(placas);
  pedidas.forEach(sinal);
  if (pedidas.length) {
    const alertas = await Anomalia.findAll({
      attributes: ['id', 'chave_veiculo', 'score', 'status', 'ocorrido_em'],
      where: { client_id: clientId, chave_veiculo: { [Op.in]: pedidas }, status: { [Op.ne]: 'DESCARTADA' } },
      order: [['ocorrido_em', 'ASC']],
      raw: true,
    });
    // em ordem crescente: fica o mais recente de cada placa
    for (const alerta of alertas) {
      sinal(alerta.chave_veiculo).anomalia = {
        id: alerta.id, score: alerta.score, faixa: faixaDoScore(alerta.score), status: alerta.status, ocorrido_em: iso(alerta.ocorrido_em),
      };
    }
  }

  const novas = chaves(primeira);
  if (novas.length) {
    const replacements = { clientId, placas: novas };
    const entradas = await sequelize.query(
      'SELECT placa, MIN(dataEntrada) AS quando FROM Trafegos WHERE client_id = :clientId AND placa IN (:placas) GROUP BY placa',
      { type: QueryTypes.SELECT, replacements }
    );
    const saidas = await sequelize.query(
      'SELECT placa, MIN(data) AS quando FROM Saidas_nao_identificadas WHERE client_id = :clientId AND placa IN (:placas) GROUP BY placa',
      { type: QueryTypes.SELECT, replacements }
    );
    const maisAntiga = new Map();
    for (const linha of [...entradas, ...saidas]) {
      if (!linha.quando) continue;
      const placa = normalizarPlaca(linha.placa);
      const quando = new Date(linha.quando).getTime();
      if (!maisAntiga.has(placa) || quando < maisAntiga.get(placa)) maisAntiga.set(placa, quando);
    }
    for (const placa of novas) {
      sinal(placa).primeira_passagem = maisAntiga.has(placa) ? iso(maisAntiga.get(placa)) : null;
    }
  }
  return { status: 'OK', sinais };
};

/**
 * Registra a revisão humana e atualiza o status do alerta.
 * CONFIRMADA = relevância operacional confirmada pelo revisor; não significa confirmação de crime.
 */
const revisar = async (loggedUserId, id, { resultado, motivo } = {}) => {
  if (!RESULTADOS.includes(resultado)) {
    return { status: 'ERROR', message: 'Resultado de revisão inválido' };
  }
  return sequelize.transaction(async (transaction) => {
    const anomalia = await Anomalia.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!anomalia) {
      return { status: 'ERROR', message: 'Alerta não encontrado' };
    }
    if (!(await podeAcessar(loggedUserId, anomalia.client_id))) {
      return SEM_PERMISSAO;
    }
    const revisao = await AnomaliaRevisao.create(
      { client_id: anomalia.client_id, anomalia_id: anomalia.id, user_id: loggedUserId, resultado, motivo: motivo || null, revisado_em: new Date() },
      { transaction }
    );
    anomalia.status = resultado;
    await anomalia.save({ transaction });
    return { status: 'OK', revisao };
  });
};

const media = (valores) => (valores.length ? valores.reduce((soma, valor) => soma + valor, 0) / valores.length : null);

/** Métricas de volume, qualidade e operação do detector nos últimos dias. */
const metricas = async (loggedUserId, clientId, dias = 14) => {
  if (!(await podeAcessar(loggedUserId, clientId))) {
    return { status: 'ERROR', message: SEM_PERMISSAO.message };
  }
  const desde = new Date(Date.now() - dias * 24 * 3600 * 1000);
  const alertas = await Anomalia.findAll({
    attributes: ['id', 'ocorrido_em', 'score', 'status', 'createdAt'],
    where: { client_id: clientId, ocorrido_em: { [Op.gte]: desde } },
    raw: true,
  });
  const porDia = {};
  for (const alerta of alertas) {
    const dia = dataLocalIso(new Date(alerta.ocorrido_em).getTime());
    porDia[dia] = porDia[dia] || { dia, observacao: 0, revisao: 0, prioridade_alta: 0 };
    porDia[dia][faixaDoScore(alerta.score)]++;
  }

  const revisoes = await AnomaliaRevisao.findAll({
    attributes: ['anomalia_id', 'resultado', 'revisado_em'],
    where: { client_id: clientId, revisado_em: { [Op.gte]: desde } },
    order: [['revisado_em', 'ASC']],
    raw: true,
  });
  const criadoEm = new Map(alertas.map((alerta) => [alerta.id, new Date(alerta.createdAt).getTime()]));
  const primeira = new Map();
  for (const revisao of revisoes) {
    if (!primeira.has(revisao.anomalia_id)) primeira.set(revisao.anomalia_id, revisao);
  }
  const tempos = [...primeira.values()]
    .filter((revisao) => criadoEm.has(revisao.anomalia_id))
    .map((revisao) => (new Date(revisao.revisado_em).getTime() - criadoEm.get(revisao.anomalia_id)) / 1000);
  const porStatus = { ABERTA: 0, REVISADA: 0, DESCARTADA: 0, CONFIRMADA: 0 };
  for (const alerta of alertas) porStatus[alerta.status] = (porStatus[alerta.status] || 0) + 1;
  const concluidas = porStatus.CONFIRMADA + porStatus.DESCARTADA;

  const [duplicados] = await sequelize.query(
    'SELECT COUNT(*) - COUNT(DISTINCT chave_deduplicacao) AS n FROM Anomalias WHERE client_id = :clientId',
    { type: QueryTypes.SELECT, replacements: { clientId } }
  );
  const execucoes = await AnomaliaExecucao.findAll({
    where: { client_id: clientId, modo: 'incremental', inicio: { [Op.gte]: desde } },
    order: [['inicio', 'DESC']],
    limit: 500,
    raw: true,
  });
  const atrasos = execucoes
    .map((execucao) => (comoObjeto(execucao.resumo) || {}).atraso_medio_s)
    .filter((valor) => valor !== null && valor !== undefined);
  const referencias = await AnomaliaExecucao.findOne({
    where: { client_id: clientId, modo: 'referencias', status: 'OK' },
    order: [['inicio', 'DESC']],
    raw: true,
  });
  const resumoReferencias = referencias ? comoObjeto(referencias.resumo) : null;

  return {
    status: 'OK',
    dias,
    alertas_por_dia: Object.values(porDia).sort((a, b) => (a.dia < b.dia ? -1 : 1)),
    total_alertas: alertas.length,
    por_status: porStatus,
    // proporção de alertas considerados relevantes entre os que tiveram conclusão (confirmado ou descartado)
    proporcao_relevantes: concluidas ? porStatus.CONFIRMADA / concluidas : null,
    proporcao_descartados: concluidas ? porStatus.DESCARTADA / concluidas : null,
    tempo_medio_revisao_s: tempos.length ? Math.round(media(tempos)) : null,
    atraso_medio_alerta_s: atrasos.length ? Math.round(media(atrasos)) : null,
    alertas_duplicados: Number(duplicados.n),
    execucoes: {
      incrementais: execucoes.length,
      com_erro: execucoes.filter((execucao) => execucao.status === 'ERRO').length,
      ultima: execucoes[0] ? { inicio: execucoes[0].inicio, status: execucoes[0].status } : null,
    },
    // qualidade dos dados da janela de referência (última atualização diária)
    dados: resumoReferencias ? { calculado_em: referencias.fim, ...resumoReferencias.dados } : null,
    perfis: resumoReferencias ? resumoReferencias.perfis : null,
    placas_com_referencia_individual: resumoReferencias ? resumoReferencias.placas_com_referencia_individual : null,
  };
};

module.exports = { listar, obter, historicoDaPlaca, sinaisDasPlacas, revisar, metricas };
