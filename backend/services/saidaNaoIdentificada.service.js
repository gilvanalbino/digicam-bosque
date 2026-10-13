'use strict';
const { Op } = require('sequelize');
const { SaidaNaoIdentificada, User, Camera, Trafego, WhiteList, sequelize } = require('../models');
const trafegoService = require('./trafego.service');
const { diferencasPlacas } = require('./placaUtil');

const list = async (cameraId) => {
  let params = {};
  if (cameraId) {
    params = {
      where: {
        camera_id: cameraId,
      },
    };
  }
  // params.attributes = { exclude: ['imagem_placa', 'imagem_carro'] };
  params.order = [['id', 'ASC']];
  const saidasNaoIdentificadas = await SaidaNaoIdentificada.findAll(params);
  return saidasNaoIdentificadas;
};

const get = async (id) => {
  return await SaidaNaoIdentificada.findByPk(id);
};

const getByIdentificadorPlaca = async (identificador_placa) => {
  let params = {
    where: {
      identificador_placa,
    },
  };

  return await SaidaNaoIdentificada.findOne(params);
};

const insert = async (newSaidaNaoIdentificada) => {
  console.log('newSaidaNaoIdentificada:', newSaidaNaoIdentificada);
  const newSaidaNaoIdentificadaDb = await SaidaNaoIdentificada.create(newSaidaNaoIdentificada);
  return { id: newSaidaNaoIdentificadaDb.id };
};

const SEM_PERMISSAO = { status: 'ERROR', message: 'Operação não permitida para este usuário' };

// admin acessa todos os clientes; usuário de cliente só o próprio
const temAcessoCliente = async (loggedUserId, clientId) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  return !!(loggedUser.admin || (loggedUser.client_id && loggedUser.client_id === clientId));
};

// saídas de veículos da green list só aparecem na fila nos primeiros 3 minutos, como na aba Em Travessia
const TEMPO_GREEN_LIST_NA_FILA_MS = 1000 * 60 * 3;

/**
 * Lista as saídas não identificadas do cliente (por padrão, somente as pendentes).
 * Nas pendentes, marca as de veículos da green list (in_whitelist) e oculta as que já passaram do tempo de exibição.
 */
const listarPorCliente = async (loggedUserId, clientId, { status = 'pendente', page, pageSize } = {}) => {
  if (!(await temAcessoCliente(loggedUserId, clientId))) {
    return { rows: [], total: 0 };
  }
  const params = {
    where: { client_id: clientId, status },
    include: [{ model: Camera, attributes: ['id', 'nome', 'portaria_id'] }],
    order: [['data', 'DESC']],
  };

  const greenList = new Map();
  if (status === 'pendente') {
    const veiculos = await WhiteList.findAll({ attributes: ['placa', 'nome'], where: { client_id: clientId }, raw: true });
    veiculos.forEach((veiculo) => greenList.set(veiculo.placa, veiculo.nome));
    if (greenList.size > 0) {
      params.where[Op.or] = [
        { placa: { [Op.notIn]: [...greenList.keys()] } },
        { createdAt: { [Op.gt]: new Date(Date.now() - TEMPO_GREEN_LIST_NA_FILA_MS) } },
      ];
    }
  }
  if (page) {
    params.limit = pageSize || 50;
    params.offset = (page - 1) * params.limit;
  }
  const { rows, count } = await SaidaNaoIdentificada.findAndCountAll(params);
  const saidas = rows.map((saida) => ({
    ...saida.toJSON(),
    in_whitelist: greenList.has(saida.placa),
    whitelist_nome: greenList.get(saida.placa) || null,
  }));
  return { rows: saidas, total: count, page: page || 1, pageSize: params.limit || count };
};

// o painel "Saídas" da tela de tráfego mostra as saídas da última hora
const JANELA_SAIDAS_RECENTES_MS = 1000 * 60 * 60;

/**
 * Saídas da última hora, de todos os veículos, da mais recente para a mais antiga:
 *  - associadas: tráfegos com saída lida por câmera (com os dados da entrada correspondente em "entrada");
 *  - pendentes: saídas sem entrada identificada, ainda não resolvidas.
 * Baixas manuais (sem leitura de câmera) e saídas arquivadas ficam de fora.
 */
const listarRecentes = async (loggedUserId, clientId) => {
  if (!(await temAcessoCliente(loggedUserId, clientId))) {
    return { rows: [], total: 0, pendentes: 0 };
  }
  const desde = new Date(Date.now() - JANELA_SAIDAS_RECENTES_MS);

  const veiculos = await WhiteList.findAll({ attributes: ['placa', 'nome'], where: { client_id: clientId }, raw: true });
  const greenList = new Map(veiculos.map((veiculo) => [veiculo.placa, veiculo.nome]));

  const pendentes = await SaidaNaoIdentificada.findAll({
    where: { client_id: clientId, status: 'pendente', data: { [Op.gte]: desde } },
    include: [{ model: Camera, attributes: ['id', 'nome', 'portaria_id'] }],
  });
  const trafegos = await Trafego.findAll({
    attributes: [
      'id', 'placa', 'placa_saida', 'nome', 'destino', 'dataEntrada', 'dataSaida', 'portaria_entrada_id',
      'portaria_saida_id', 'in_whitelist', 'imagem', 'imagem_thumb', 'imagem_placa', 'imagem_saida',
      'imagem_saida_thumb', 'imagem_saida_placa',
    ],
    where: {
      client_id: clientId,
      dataSaida: { [Op.gte]: desde },
      identificador_placa_saida: { [Op.ne]: null },
    },
  });
  // saídas associadas pelo sistema por placa próxima: o operador pode conferir e desfazer
  const automaticas = await SaidaNaoIdentificada.findAll({
    attributes: ['id', 'trafego_id'],
    where: { trafego_id: trafegos.map((trafego) => trafego.id), status: 'associada', associacao_automatica: true },
    raw: true,
  });
  const saidaAutomatica = new Map(automaticas.map((saida) => [saida.trafego_id, saida.id]));

  const rows = [
    ...pendentes.map((saida) => ({
      ...saida.toJSON(),
      chave: `s${saida.id}`,
      portaria_id: saida.Camera ? saida.Camera.portaria_id : null,
      in_whitelist: greenList.has(saida.placa),
      whitelist_nome: greenList.get(saida.placa) || null,
      entrada: null,
    })),
    ...trafegos.map((trafego) => ({
      chave: `t${trafego.id}`,
      status: 'associada',
      placa: trafego.placa_saida || trafego.placa,
      data: trafego.dataSaida,
      portaria_id: trafego.portaria_saida_id,
      imagem_carro: trafego.imagem_saida,
      imagem_carro_thumb: trafego.imagem_saida_thumb,
      imagem_placa: trafego.imagem_saida_placa,
      in_whitelist: !!trafego.in_whitelist,
      whitelist_nome: trafego.in_whitelist ? trafego.nome : null,
      // id da saída a informar para desfazer a associação automática
      associacao_automatica: saidaAutomatica.has(trafego.id),
      saida_id: saidaAutomatica.get(trafego.id) || null,
      entrada: {
        id: trafego.id,
        placa: trafego.placa,
        dataEntrada: trafego.dataEntrada,
        portaria_id: trafego.portaria_entrada_id,
        destino: trafego.destino,
        imagem: trafego.imagem,
        imagem_thumb: trafego.imagem_thumb,
        imagem_placa: trafego.imagem_placa,
      },
    })),
  ].sort((a, b) => new Date(b.data) - new Date(a.data));

  return { rows, total: rows.length, pendentes: pendentes.length };
};

// o arquivamento em lote vale para saídas pendentes com mais de 2 horas
const IDADE_MINIMA_LOTE_MS = 1000 * 60 * 60 * 2;

/**
 * Arquiva, de uma vez, todas as saídas pendentes do cliente com mais de 2 horas.
 * Só para administradores (do sistema ou do próprio cliente).
 */
const arquivarAntigas = async (loggedUserId, clientId) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  if (!(loggedUser.admin || (loggedUser.admin_client && loggedUser.client_id === clientId))) {
    return { status: 'ERROR', message: 'Operação permitida somente para administradores' };
  }
  const [quantidade] = await SaidaNaoIdentificada.update(
    {
      status: 'arquivada',
      motivo_arquivamento: 'Arquivamento em lote: saída com mais de 2 horas',
      resolvido_em: new Date(),
      user_resolucao: loggedUserId,
    },
    {
      where: {
        client_id: clientId,
        status: 'pendente',
        data: { [Op.lt]: new Date(Date.now() - IDADE_MINIMA_LOTE_MS) },
      },
    }
  );
  return { status: 'OK', quantidade };
};

/**
 * Arquiva a saída sem associá-la a nenhuma entrada. Não gera registro de tráfego.
 */
const arquivar = async (loggedUserId, id, motivo) => {
  return await sequelize.transaction(async (transaction) => {
    const saida = await SaidaNaoIdentificada.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!saida) {
      return { status: 'ERROR', message: 'Saída não identificada não encontrada' };
    }
    if (!(await temAcessoCliente(loggedUserId, saida.client_id))) {
      return SEM_PERMISSAO;
    }
    if (saida.status !== 'pendente') {
      return { status: 'ERROR', message: 'Esta saída já foi resolvida por outro operador' };
    }
    saida.status = 'arquivada';
    saida.motivo_arquivamento = motivo || null;
    saida.resolvido_em = new Date();
    saida.user_resolucao = loggedUserId;
    await saida.save({ transaction });
    return { status: 'OK' };
  });
};

/**
 * Associa manualmente uma saída não identificada a uma entrada sem saída.
 * O tráfego resultante fica igual ao gerado pelo casamento automático de placas.
 */
const associar = async (loggedUserId, id, trafegoId) => {
  return await sequelize.transaction(async (transaction) => {
    const saida = await SaidaNaoIdentificada.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!saida) {
      return { status: 'ERROR', message: 'Saída não identificada não encontrada' };
    }
    if (!(await temAcessoCliente(loggedUserId, saida.client_id))) {
      return SEM_PERMISSAO;
    }
    if (saida.status !== 'pendente') {
      return { status: 'ERROR', message: 'Esta saída já foi resolvida por outro operador' };
    }

    const trafego = await Trafego.findByPk(trafegoId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!trafego || trafego.client_id !== saida.client_id) {
      return { status: 'ERROR', message: 'Entrada não encontrada' };
    }
    if (trafego.dataSaida) {
      return { status: 'ERROR', message: 'Esta entrada já possui saída registrada' };
    }
    if (saida.data < trafego.dataEntrada) {
      return { status: 'ERROR', message: 'O horário da saída é anterior ao horário da entrada' };
    }

    const camera = await Camera.findByPk(saida.camera_id, { transaction });
    trafegoService.aplicarSaidaNoTrafego(trafego, {
      dataSaida: saida.data,
      placa: saida.placa,
      identificador_placa: saida.identificador_placa,
      portaria_id: camera ? camera.portaria_id : null,
      user_id: loggedUserId,
      automatica: false,
      imagem: saida.imagem_carro,
      imagem_thumb: saida.imagem_carro_thumb,
      imagem_placa: saida.imagem_placa,
    });
    await trafego.save({ transaction });

    saida.status = 'associada';
    saida.trafego_id = trafego.id;
    saida.resolvido_em = new Date();
    saida.user_resolucao = loggedUserId;
    await saida.save({ transaction });

    return { status: 'OK', trafego };
  });
};

// diferença máxima (distância de edição) entre as placas para a saída ser associada automaticamente.
// Com 2 caracteres de diferença o sistema não associa sozinho: o painel de saídas só sugere a entrada (do
// mesmo dia) e o operador decide (frontend/src/utils/placaUtil.js, placaSugerida).
const MAX_DIFERENCAS_PLACA_PROXIMA = 1;

/**
 * Procura, entre os veículos em travessia do cliente (os mesmos da aba Em Travessia), a entrada de placa mais
 * próxima da placa lida na saída. No empate vale a entrada mais recente. Retorna null quando nenhuma serve.
 * Uma placa de saída que está na green list foi lida corretamente e não é casada por aproximação.
 */
const obterEntradaPorPlacaProxima = async (clientId, placa, dataSaida) => {
  if (!placa || (await WhiteList.findOne({ attributes: ['id'], where: { client_id: clientId, placa } }))) {
    return null;
  }
  const entradas = await Trafego.findAll({
    attributes: ['id', 'placa', 'dataEntrada'],
    where: {
      client_id: clientId,
      destino: 'cruzar',
      dataSaida: null,
      dataEntrada: { [Op.lte]: dataSaida },
      [Op.or]: [
        { in_whitelist: { [Op.not]: true } },
        { dataEntrada: { [Op.gt]: new Date(Date.now() - TEMPO_GREEN_LIST_NA_FILA_MS) } },
      ],
    },
    order: [['dataEntrada', 'DESC']],
    raw: true,
  });
  let escolhida = null;
  let menor = MAX_DIFERENCAS_PLACA_PROXIMA + 1;
  for (const entrada of entradas) {
    const diferencas = diferencasPlacas(entrada.placa, placa);
    if (diferencas < menor) {
      escolhida = entrada;
      menor = diferencas;
    }
  }
  return escolhida;
};

/**
 * Registra uma saída lida pela câmera na entrada de placa próxima e guarda a saída como associada
 * automaticamente, para o operador conferir e, se estiver errada, desfazer (ver desassociar).
 * Retorna null se a entrada já recebeu saída ou se a saída já foi registrada.
 */
const associarAutomaticamente = async (loggedUserId, saida, trafegoId, portariaId) => {
  return await sequelize.transaction(async (transaction) => {
    const trafego = await Trafego.findByPk(trafegoId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!trafego || trafego.dataSaida || trafego.client_id !== saida.client_id) {
      return null;
    }
    const existente = await SaidaNaoIdentificada.findOne({
      where: { identificador_placa: saida.identificador_placa },
      transaction,
    });
    if (existente) {
      return null;
    }
    trafegoService.aplicarSaidaNoTrafego(trafego, {
      dataSaida: saida.data,
      placa: saida.placa,
      identificador_placa: saida.identificador_placa,
      portaria_id: portariaId,
      user_id: loggedUserId,
      automatica: true,
      imagem: saida.imagem_carro,
      imagem_thumb: saida.imagem_carro_thumb,
      imagem_placa: saida.imagem_placa,
    });
    await trafego.save({ transaction });
    await SaidaNaoIdentificada.create(
      { ...saida, status: 'associada', trafego_id: trafego.id, resolvido_em: new Date(), associacao_automatica: true },
      { transaction }
    );
    return trafego;
  });
};

/**
 * Desfaz uma associação automática por placa próxima: a entrada volta a ficar sem saída e a saída volta
 * para as pendentes (sem entrada identificada), onde pode ser associada a outra entrada ou arquivada.
 */
const desassociar = async (loggedUserId, id) => {
  return await sequelize.transaction(async (transaction) => {
    const saida = await SaidaNaoIdentificada.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!saida) {
      return { status: 'ERROR', message: 'Saída não encontrada' };
    }
    if (!(await temAcessoCliente(loggedUserId, saida.client_id))) {
      return SEM_PERMISSAO;
    }
    if (saida.status !== 'associada' || !saida.associacao_automatica) {
      return { status: 'ERROR', message: 'Somente associações automáticas por placa próxima podem ser desfeitas' };
    }
    const trafego = await Trafego.findByPk(saida.trafego_id, { transaction, lock: transaction.LOCK.UPDATE });
    // só mexe na entrada se a saída registrada nela ainda for esta
    if (trafego && trafego.identificador_placa_saida === saida.identificador_placa) {
      trafego.dataSaida = null;
      trafego.placa_saida = null;
      trafego.identificador_placa_saida = null;
      trafego.portaria_saida_id = null;
      trafego.user_reg_saida = null;
      trafego.saida_automatica = null;
      trafego.imagem_saida = null;
      trafego.imagem_saida_thumb = null;
      trafego.imagem_saida_placa = null;
      await trafego.save({ transaction });
    }
    saida.status = 'pendente';
    saida.trafego_id = null;
    saida.resolvido_em = null;
    saida.user_resolucao = null;
    saida.associacao_automatica = false;
    await saida.save({ transaction });
    return { status: 'OK' };
  });
};

module.exports = {
  list,
  get,
  insert,
  getByIdentificadorPlaca,
  listarPorCliente,
  listarRecentes,
  arquivarAntigas,
  arquivar,
  associar,
  obterEntradaPorPlacaProxima,
  associarAutomaticamente,
  desassociar,
};
