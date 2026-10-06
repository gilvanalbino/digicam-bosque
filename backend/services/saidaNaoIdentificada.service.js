'use strict';
const { SaidaNaoIdentificada, User, Camera, Trafego, sequelize } = require('../models');
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

/**
 * Lista as saídas não identificadas do cliente (por padrão, somente as pendentes)
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
  if (page) {
    params.limit = pageSize || 50;
    params.offset = (page - 1) * params.limit;
  }
  const { rows, count } = await SaidaNaoIdentificada.findAndCountAll(params);
  return { rows, total: count, page: page || 1, pageSize: params.limit || count };
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
  arquivar,
  associar,
};
