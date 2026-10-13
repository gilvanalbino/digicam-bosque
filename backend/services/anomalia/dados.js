'use strict';

// Acesso a dados do detector de anomalias. As tabelas operacionais são somente lidas; as gravações ficam
// restritas às tabelas Anomalia_*.
const { QueryTypes, Op } = require('sequelize');
const { sequelize, Anomalia, AnomaliaEstado, AnomaliaReferencia, AnomaliaExecucao } = require('../../models');
const { VERSAO_MODELO } = require('./parametros');

const selecionar = (sql, replacements) => sequelize.query(sql, { type: QueryTypes.SELECT, replacements });

// As colunas de data são gravadas em UTC. Nas consultas diretas, uma Date passada como parâmetro seria
// formatada no fuso do processo; por isso os limites vão como texto, já em UTC.
const emUtc = (data) => new Date(data).toISOString().slice(0, 19).replace('T', ' ');

let colunaStatusSaidas = null;
// bancos anteriores à conciliação manual não têm a coluna "status" em Saidas_nao_identificadas
const saidasTemStatus = async () => {
  if (colunaStatusSaidas === null) {
    const linhas = await selecionar(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Saidas_nao_identificadas' AND COLUMN_NAME = 'status'`
    );
    colunaStatusSaidas = Number(linhas[0].n) > 0;
  }
  return colunaStatusSaidas;
};

const listarClientes = () => selecionar('SELECT DISTINCT client_id AS id FROM Cameras WHERE client_id IS NOT NULL ORDER BY 1');

/** Linhas brutas de um cliente com entrada (ou leitura de saída) entre "de" e "ate". */
const carregarHistorico = async (clientId, de, ate) => {
  const trafegos = await selecionar(
    `SELECT id, placa, placa_saida, dataEntrada, dataSaida, identificador_placa_saida, portaria_entrada_id,
            portaria_saida_id, in_whitelist, in_blacklist
       FROM Trafegos
      WHERE client_id = :clientId AND dataEntrada >= :de AND dataEntrada < :ate`,
    { clientId, de: emUtc(de), ate: emUtc(ate) }
  );
  // saída registrada depois do fim do período ainda não aconteceu para quem avalia o período
  for (const trafego of trafegos) {
    if (trafego.dataSaida && trafego.dataSaida >= ate) {
      trafego.dataSaida = null;
      trafego.identificador_placa_saida = null;
    }
  }
  const status = (await saidasTemStatus()) ? 's.status' : "'pendente'";
  const saidas = await selecionar(
    `SELECT s.id, s.placa, s.data, s.camera_id, ${status} AS status
       FROM Saidas_nao_identificadas s INNER JOIN Cameras c ON c.id = s.camera_id
      WHERE c.client_id = :clientId AND s.data >= :de AND s.data < :ate`,
    { clientId, de: emUtc(de), ate: emUtc(ate) }
  );
  const cameras = await selecionar('SELECT id, portaria_id FROM Cameras WHERE client_id = :clientId', { clientId });
  // green list atual do cliente: as placas dela não são avaliadas
  const greenList = await selecionar('SELECT placa FROM WhiteList WHERE client_id = :clientId', { clientId });
  return {
    trafegos,
    saidas,
    portariaDaCamera: new Map(cameras.map((camera) => [camera.id, camera.portaria_id])),
    greenList: greenList.map((veiculo) => veiculo.placa),
  };
};

// ---------- execuções (cursor do incremental e métricas)

/** Fim do período da última execução incremental concluída: dali em diante ainda não foi analisado. */
const obterCursor = async (clientId) => {
  const ultima = await AnomaliaExecucao.findOne({
    where: { client_id: clientId, modo: 'incremental', status: 'OK', versao_modelo: VERSAO_MODELO },
    order: [['periodo_fim', 'DESC']],
  });
  return ultima ? ultima.periodo_fim : null;
};

const ultimaExecucaoOk = (clientId, modo) =>
  AnomaliaExecucao.findOne({
    where: { client_id: clientId, modo, status: 'OK', versao_modelo: VERSAO_MODELO },
    order: [['inicio', 'DESC']],
  });

const iniciarExecucao = (clientId, modo, periodoInicio, periodoFim) =>
  AnomaliaExecucao.create({
    client_id: clientId, modo, status: 'EM_ANDAMENTO', inicio: new Date(), periodo_inicio: periodoInicio,
    periodo_fim: periodoFim, versao_modelo: VERSAO_MODELO,
  });

const concluirExecucao = (execucao, resumo) => execucao.update({ status: 'OK', fim: new Date(), resumo });

const falharExecucao = (execucao, erro) =>
  execucao.update({ status: 'ERRO', fim: new Date(), erro: String((erro && erro.stack) || erro).slice(0, 4000) });

/**
 * Executa "tarefa" com uma trava no banco por cliente, para duas execuções não rodarem ao mesmo tempo.
 * Retorna null, sem executar, quando outra execução está com a trava.
 */
const comTrava = async (clientId, tarefa) =>
  sequelize.transaction(async (transaction) => {
    const nome = `digicam_anomalias_${clientId}`;
    const [linha] = await sequelize.query('SELECT GET_LOCK(:nome, 0) AS ok', {
      type: QueryTypes.SELECT, replacements: { nome }, transaction,
    });
    if (Number(linha.ok) !== 1) return null;
    try {
      return await tarefa();
    } finally {
      await sequelize.query('SELECT RELEASE_LOCK(:nome)', { type: QueryTypes.SELECT, replacements: { nome }, transaction });
    }
  });

// ---------- estado de mudança persistente por placa

const carregarEstados = async (clientId) => {
  const linhas = await AnomaliaEstado.findAll({
    attributes: ['chave_veiculo', 'dados'],
    where: { client_id: clientId, versao_modelo: VERSAO_MODELO },
    raw: true,
  });
  return new Map(linhas.map((linha) => [linha.chave_veiculo, typeof linha.dados === 'string' ? JSON.parse(linha.dados) : linha.dados]));
};

const salvarEstados = async (clientId, estados, chaves) => {
  const agora = new Date();
  const linhas = [...chaves].map((chave) => {
    const estado = estados.get(chave);
    const ultima = Math.max(estado.tD || 0, estado.tF || 0);
    return {
      client_id: clientId, chave_veiculo: chave, ewma_duracao: estado.ed, ewma_frequencia: estado.ef,
      ultima_passagem_em: ultima ? new Date(ultima) : null, dados: estado, versao_modelo: VERSAO_MODELO,
      createdAt: agora, updatedAt: agora,
    };
  });
  for (let i = 0; i < linhas.length; i += 1000) {
    await AnomaliaEstado.bulkCreate(linhas.slice(i, i + 1000), {
      updateOnDuplicate: ['ewma_duracao', 'ewma_frequencia', 'ultima_passagem_em', 'dados', 'versao_modelo', 'updatedAt'],
    });
  }
  return linhas.length;
};

// ---------- alertas

const chaveDeduplicacao = (clientId, alerta) => `${clientId}|${alerta.chave_veiculo}|${alerta.dia}|${VERSAO_MODELO}`;

const comoObjeto = (valor) => (typeof valor === 'string' ? JSON.parse(valor) : valor);

/** Alertas já gravados a partir de "desde", para a regra de anomalia que persiste. */
const carregarAlertasRecentes = async (clientId, desde) => {
  const linhas = await Anomalia.findAll({
    attributes: ['id', 'chave_veiculo', 'chave_deduplicacao', 'score', 'evidencias'],
    where: { client_id: clientId, versao_modelo: VERSAO_MODELO, ocorrido_em: { [Op.gte]: desde } },
    raw: true,
  });
  return linhas.map((linha) => ({
    id: linha.id,
    chave_veiculo: linha.chave_veiculo,
    dia: linha.chave_deduplicacao.split('|')[2],
    score: linha.score,
    principal: comoObjeto(linha.evidencias).composicao.principal,
  }));
};

/**
 * Grava os alertas sem duplicar: a chave é cliente + placa + dia + versão do modelo.
 *  - alerta novo: inserido como ABERTA;
 *  - alerta existente ainda ABERTA: atualizado quando o score novo é maior (execução incremental, que vê só
 *    parte do dia) ou sempre ("substituir", no reprocessamento de um período inteiro);
 *  - alerta já revisado: nunca é alterado.
 */
const gravarAlertas = async (clientId, alertas, { substituir = false } = {}) => {
  const resultado = { novos: 0, atualizados: 0, mantidos: 0, ids_novos: [] };
  for (let i = 0; i < alertas.length; i += 500) {
    const lote = alertas.slice(i, i + 500);
    const chaves = lote.map((alerta) => chaveDeduplicacao(clientId, alerta));
    const existentes = await Anomalia.findAll({ where: { chave_deduplicacao: chaves } });
    const porChave = new Map(existentes.map((existente) => [existente.chave_deduplicacao, existente]));
    for (const alerta of lote) {
      const chave = chaveDeduplicacao(clientId, alerta);
      const { dia, ...campos } = alerta;
      const existente = porChave.get(chave);
      if (!existente) {
        const criado = await Anomalia.create({
          ...campos, client_id: clientId, chave_deduplicacao: chave, tipo: 'dia', versao_modelo: VERSAO_MODELO, status: 'ABERTA',
        });
        resultado.novos++;
        resultado.ids_novos.push(criado.id);
        continue;
      }
      if (existente.status !== 'ABERTA' || !(substituir || alerta.score > existente.score)) {
        resultado.mantidos++;
        continue;
      }
      if (!substituir) {
        // o alerta gravado já contava eventos e repetições de execuções anteriores do mesmo dia
        const anterior = comoObjeto(existente.evidencias) || {};
        campos.evidencias.eventos_no_dia += anterior.eventos_no_dia || 0;
        campos.evidencias.repeticoes = [...(anterior.repeticoes || []), ...campos.evidencias.repeticoes];
      }
      await existente.update(campos);
      resultado.atualizados++;
    }
  }
  return resultado;
};

/** Anota, no alerta original, as repetições da mesma anomalia em dias seguintes. */
const aplicarRepeticoes = async (repeticoes) => {
  let aplicadas = 0;
  for (const repeticao of repeticoes) {
    const alerta = await Anomalia.findByPk(repeticao.id);
    if (!alerta) continue;
    const evidencias = comoObjeto(alerta.evidencias) || {};
    const lista = evidencias.repeticoes || [];
    const existente = lista.find((item) => item.dia === repeticao.dia);
    if (existente && existente.score >= repeticao.score) continue;
    const nova = { dia: repeticao.dia, score: repeticao.score, ocorrido_em: repeticao.ocorrido_em };
    evidencias.repeticoes = [...lista.filter((item) => item.dia !== repeticao.dia), nova];
    await alerta.update({ evidencias });
    aplicadas++;
  }
  return aplicadas;
};

// ---------- referências

/** Grava o instantâneo das referências de um dia (perfis e placas com histórico) e remove os vencidos. */
const gravarReferencias = async (clientId, referencia, retencaoDias) => {
  const agora = new Date();
  const comuns = {
    client_id: clientId, janela_inicio: new Date(referencia.desde), janela_fim: new Date(referencia.inicioDia),
    versao_modelo: VERSAO_MODELO, calculado_em: agora, createdAt: agora, updatedAt: agora,
  };
  const linhas = [];
  for (const agregado of Object.values(referencia.agregados)) {
    linhas.push({
      ...comuns, chave_veiculo: null, perfil: agregado.perfil, qtd_viagens: agregado.duracao.amostra,
      qtd_passagens: agregado.passagens, duracao_mediana: agregado.duracao.mediana, duracao_mad: agregado.duracao.mad,
      duracao_p95: agregado.duracao.p95, duracao_p99: agregado.duracao.p99,
      dados: { placas: agregado.placas, dia: agregado.dia, hora: agregado.hora, semana: agregado.semana, histograma: agregado.histograma },
    });
  }
  for (const individual of referencia.individuais) {
    linhas.push({
      ...comuns, chave_veiculo: individual.chave, perfil: individual.perfil, qtd_viagens: individual.duracao.amostra,
      qtd_passagens: individual.passagens, duracao_mediana: individual.duracao.mediana, duracao_mad: individual.duracao.mad,
      duracao_p95: individual.duracao.p95, duracao_p99: individual.duracao.p99, dados: null,
    });
  }
  await sequelize.transaction(async (transaction) => {
    await AnomaliaReferencia.destroy({
      where: { client_id: clientId, janela_fim: comuns.janela_fim, versao_modelo: VERSAO_MODELO },
      transaction,
    });
    for (let i = 0; i < linhas.length; i += 1000) {
      await AnomaliaReferencia.bulkCreate(linhas.slice(i, i + 1000), { transaction });
    }
  });
  const removidas = await AnomaliaReferencia.destroy({
    where: { client_id: clientId, janela_fim: { [Op.lt]: new Date(referencia.inicioDia - retencaoDias * 24 * 3600 * 1000) } },
  });
  return { gravadas: linhas.length, removidas };
};

module.exports = {
  sequelize,
  selecionar,
  listarClientes,
  carregarHistorico,
  obterCursor,
  ultimaExecucaoOk,
  iniciarExecucao,
  concluirExecucao,
  falharExecucao,
  comTrava,
  carregarEstados,
  salvarEstados,
  carregarAlertasRecentes,
  gravarAlertas,
  aplicarRepeticoes,
  gravarReferencias,
};
