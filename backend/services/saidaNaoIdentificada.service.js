'use strict';
const { Op } = require('sequelize');
const { SaidaNaoIdentificada, User, Camera, Trafego, WhiteList, sequelize } = require('../models');
const trafegoService = require('./trafego.service');

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

module.exports = {
  list,
  get,
  insert,
  getByIdentificadorPlaca,
  listarPorCliente,
  arquivarAntigas,
  arquivar,
  associar,
};
