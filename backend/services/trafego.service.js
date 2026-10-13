'use strict';

const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { Trafego, User, SaidaNaoIdentificada, Camera, WhiteList } = require('../models');
const TrafegoRoutes = require('../routes/trafego.route');

const listarSemSaida = async (loggedUserId, clientId) => {
  // se é admin, pode listar todos
  // se é usuário em cliente, só pode listar as trafego do cliente
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin || (loggedUser.client_id && loggedUser.client_id === clientId)) {
    let params = {};
    if (clientId) {
      params = {
        where: {
          client_id: clientId,
          dataSaida: null,
          [Op.or]: [
            {
              in_whitelist: {
                [Op.not]: true,
              },
            },
            {
              [Op.and]: [
                {
                  in_whitelist: true,
                },
                {
                  dataEntrada: {
                    [Op.gt]: new Date(Date.now() - 1000 * 60 * 3),
                  },
                },
              ],
            },
          ],
        },
      };
    }
    return await Trafego.findAll(params);
  } else {
    return [];
  }
};

const listarComSaida = async (loggedUserId, clientId) => {
  const ret = await listarPorStatus(loggedUserId, clientId, { status: 'saidas' });
  return ret.rows;
};

// veículos de green list só aparecem como pendentes de saída nos primeiros 3 minutos
const filtroWhiteListSemSaida = () => ({
  [Op.or]: [
    { in_whitelist: { [Op.not]: true } },
    {
      [Op.and]: [{ in_whitelist: true }, { dataEntrada: { [Op.gt]: new Date(Date.now() - 1000 * 60 * 3) } }],
    },
  ],
});

/**
 * Lista os tráfegos do cliente pelo status derivado de destino + dataSaida:
 *  - travessia: destino = cruzar, sem saída
 *  - servico:   destino IN (servico, morador), sem saída
 *  - sem_saida: qualquer destino, sem saída
 *  - saidas:    com saída registrada no dia corrente
 * Filtros opcionais: placa, entradaDe, entradaAte, ordem, page, pageSize.
 */
const listarPorStatus = async (loggedUserId, clientId, filtros) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  if (!(loggedUser.admin || (loggedUser.client_id && loggedUser.client_id === clientId))) {
    return { rows: [], total: 0 };
  }

  const { status, placa, entradaDe, entradaAte, ordem, page, pageSize } = filtros;
  const condicoes = [{ client_id: clientId }];

  if (status === 'saidas') {
    condicoes.push({ dataSaida: { [Op.gte]: dayjs().startOf('day').toDate() } });
  } else {
    condicoes.push({ dataSaida: null });
    condicoes.push(filtroWhiteListSemSaida());
    if (status === 'travessia') {
      condicoes.push({ destino: 'cruzar' });
    } else if (status === 'servico') {
      condicoes.push({ destino: { [Op.in]: ['servico', 'morador'] } });
    }
  }

  if (placa) {
    const texto = `%${placa.toUpperCase().replace(/[^A-Z0-9]/g, '')}%`;
    condicoes.push({ [Op.or]: [{ placa: { [Op.like]: texto } }, { placa_saida: { [Op.like]: texto } }] });
  }
  if (entradaDe) {
    condicoes.push({ dataEntrada: { [Op.gte]: entradaDe } });
  }
  if (entradaAte) {
    condicoes.push({ dataEntrada: { [Op.lte]: entradaAte } });
  }

  // veículos sem saída: entradas mais recentes primeiro
  let order = [['dataEntrada', 'DESC']];
  if (status === 'saidas') {
    order = ordem === 'saida_asc' ? [['dataSaida', 'ASC']] : [['dataSaida', 'DESC']];
  }

  const params = { where: { [Op.and]: condicoes }, order };
  if (page) {
    params.limit = pageSize || 50;
    params.offset = (page - 1) * params.limit;
  }

  const { rows, count } = await Trafego.findAndCountAll(params);
  return { rows, total: count, page: page || 1, pageSize: params.limit || count };
};

/**
 * Eventos de um dia para a linha do tempo: tráfegos com entrada ou saída no dia e saídas sem entrada
 * identificada do dia (pendentes e arquivadas; as associadas já estão no tráfego correspondente).
 * "dia" no formato AAAA-MM-DD; sem ele, vale o dia corrente.
 */
const linhaDoTempo = async (loggedUserId, clientId, dia) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const base = dia ? dayjs(dia) : dayjs();
  const inicio = base.startOf('day').toDate();
  const fim = base.endOf('day').toDate();
  if (!(loggedUser.admin || (loggedUser.client_id && loggedUser.client_id === clientId))) {
    return { dia: base.format('YYYY-MM-DD'), trafegos: [], saidasSemEntrada: [] };
  }
  const noDia = { [Op.between]: [inicio, fim] };
  const trafegos = await Trafego.findAll({
    attributes: [
      'id', 'placa', 'placa_saida', 'nome', 'destino', 'dataEntrada', 'dataSaida', 'portaria_entrada_id',
      'portaria_saida_id', 'saida_automatica', 'identificador_placa_saida', 'in_whitelist', 'in_blacklist', 'imagem', 'imagem_thumb',
      'imagem_placa', 'imagem_saida', 'imagem_saida_thumb', 'imagem_saida_placa',
    ],
    where: { client_id: clientId, [Op.or]: [{ dataEntrada: noDia }, { dataSaida: noDia }] },
  });
  const saidasSemEntrada = await SaidaNaoIdentificada.findAll({
    attributes: ['id', 'placa', 'data', 'status', 'imagem_carro', 'imagem_carro_thumb', 'imagem_placa'],
    where: { client_id: clientId, data: noDia, status: { [Op.in]: ['pendente', 'arquivada'] } },
    include: [{ model: Camera, attributes: ['id', 'nome', 'portaria_id'] }],
  });
  return { dia: base.format('YYYY-MM-DD'), trafegos, saidasSemEntrada };
};

// operações em lote da tela de tráfego valem para registros com mais de 2 horas
const IDADE_MINIMA_LOTE_MS = 1000 * 60 * 60 * 2;

/**
 * Registra saída manual, de uma vez, em todas as entradas "cruzar condomínio" sem saída com mais de 2 horas
 * que aparecem na aba Em Travessia. Só para administradores (do sistema ou do próprio cliente).
 */
const registrarSaidaManualAntigas = async (loggedUserId, clientId) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  if (!(loggedUser.admin || (loggedUser.admin_client && loggedUser.client_id === clientId))) {
    return { status: 'ERROR', message: 'Operação permitida somente para administradores' };
  }
  const [quantidade] = await Trafego.update(
    { dataSaida: new Date(), user_reg_saida: loggedUserId, saida_automatica: false },
    {
      where: {
        client_id: clientId,
        destino: 'cruzar',
        dataSaida: null,
        in_whitelist: { [Op.not]: true },
        dataEntrada: { [Op.lt]: new Date(Date.now() - IDADE_MINIMA_LOTE_MS) },
      },
    }
  );
  return { status: 'OK', quantidade };
};

/**
 * Grava os dados de saída em um tráfego — usado pela saída automática (câmera)
 * e pela associação manual de saídas não identificadas.
 */
const aplicarSaidaNoTrafego = (trafego, saida) => {
  trafego.dataSaida = saida.dataSaida;
  trafego.placa_saida = saida.placa;
  trafego.identificador_placa_saida = saida.identificador_placa;
  trafego.portaria_saida_id = saida.portaria_id;
  trafego.user_reg_saida = saida.user_id;
  trafego.saida_automatica = saida.automatica;
  if (saida.imagem) {
    trafego.imagem_saida = saida.imagem;
  }
  if (saida.imagem_thumb) {
    trafego.imagem_saida_thumb = saida.imagem_thumb;
  }
  if (saida.imagem_placa) {
    trafego.imagem_saida_placa = saida.imagem_placa;
  }
  return trafego;
};

const listPorPeriodo = async (
  loggedUserId,
  clientId,
  dataHoraInicio,
  dataHoraFim,
  portaria_entrada_id,
  portaria_saida_id,
  texto_placa_nome
) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  if (loggedUser.admin || loggedUser.client_id === clientId) {
    const filtros = [
      { client_id: clientId },
      {
        dataEntrada: {
          [Op.gte]: dataHoraInicio,
        },
      },
      {
        dataEntrada: {
          [Op.lte]: dataHoraFim,
        },
      },
    ];
    if (portaria_entrada_id) {
      filtros.push({ portaria_entrada_id });
    }
    if (portaria_saida_id) {
      filtros.push({ portaria_saida_id });
    }
    if (texto_placa_nome) {
      filtros.push({
        [Op.or]: [{ nome: texto_placa_nome }, { placa: texto_placa_nome }],
      });
    }
    const params = {
      where: {
        [Op.and]: filtros,
      },
      order: [['dataEntrada', 'ASC']],
    };
    console.log('params: ', params);
    const trafegos = await Trafego.findAll(params);
    const saidas = await listarSaidasSemEntradaPorPeriodo(
      clientId,
      dataHoraInicio,
      dataHoraFim,
      portaria_entrada_id,
      portaria_saida_id,
      texto_placa_nome
    );
    if (saidas.length === 0) {
      return trafegos;
    }
    const instante = (linha) => new Date(linha.dataEntrada || linha.dataSaida).getTime();
    return [...trafegos.map((trafego) => trafego.toJSON()), ...saidas].sort((a, b) => instante(a) - instante(b));
  } else {
    throw Error('Operation not allowed');
  }
};

/**
 * Saídas sem entrada identificada do período (pendentes e arquivadas; as associadas já estão no tráfego
 * correspondente), no formato das linhas de tráfego do relatório: sem dados de entrada e com a leitura da
 * câmera nos campos de saída. Com filtro de portaria de entrada não há o que listar: elas não têm entrada.
 */
const listarSaidasSemEntradaPorPeriodo = async (
  clientId,
  dataHoraInicio,
  dataHoraFim,
  portaria_entrada_id,
  portaria_saida_id,
  texto_placa_nome
) => {
  if (portaria_entrada_id) {
    return [];
  }
  const where = {
    client_id: clientId,
    data: { [Op.between]: [dataHoraInicio, dataHoraFim] },
    status: { [Op.in]: ['pendente', 'arquivada'] },
  };
  if (texto_placa_nome) {
    where.placa = texto_placa_nome;
  }
  const camera = { model: Camera, attributes: ['id', 'portaria_id'] };
  if (portaria_saida_id) {
    camera.where = { portaria_id: portaria_saida_id };
  }
  const saidas = await SaidaNaoIdentificada.findAll({
    attributes: ['id', 'placa', 'data', 'status', 'imagem_carro', 'imagem_carro_thumb', 'imagem_placa'],
    where,
    include: [camera],
  });
  if (saidas.length === 0) {
    return [];
  }
  const veiculos = await WhiteList.findAll({ attributes: ['placa'], where: { client_id: clientId }, raw: true });
  const greenList = new Set(veiculos.map((veiculo) => veiculo.placa));
  return saidas.map((saida) => ({
    id: `s${saida.id}`,
    saida_sem_entrada: true,
    placa: saida.placa,
    nome: null,
    destino: null,
    observacao: saida.status === 'arquivada' ? 'Saída sem entrada identificada (arquivada)' : 'Saída sem entrada identificada',
    in_whitelist: greenList.has(saida.placa),
    dataEntrada: null,
    portaria_entrada_id: null,
    dataSaida: saida.data,
    portaria_saida_id: saida.Camera ? saida.Camera.portaria_id : null,
    imagem_saida: saida.imagem_carro,
    imagem_saida_thumb: saida.imagem_carro_thumb,
    imagem_saida_placa: saida.imagem_placa,
  }));
};

const get = async (loggedUserId, id) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const trafego = await Trafego.findByPk(id);
  if (!trafego) {
    throw Error('Trafego informado não existe');
  }
  if (loggedUser.admin || loggedUser.client_id === trafego.client_id) {
    return trafego;
  } else {
  }
};

const insert = async (loggedUserId, newTrafego) => {
  // usuário de cliente só pode cadastrar trafego no mesmo cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }

  if (loggedUser.admin || loggedUser.client_id === newTrafego.client_id) {
    newTrafego.user_reg_entrada = loggedUserId;
    return await Trafego.create(newTrafego);
  } else {
    throw Error('Operation not allowed');
  }
};

const update = async (loggedUserId, updatedTrafego) => {
  // usuário cliente só pode atualizar trafego no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const trafego = await Trafego.findByPk(updatedTrafego.id);
  if (!trafego) {
    throw Error('Trafego informado não existe');
  }
  if (
    loggedUser.admin ||
    loggedUser.client_id === trafego.client_id // cliente não pode cadastrar trafego em outro cliente
  ) {
    trafego.placa = updatedTrafego.placa;
    trafego.nome = updatedTrafego.nome;
    trafego.destino = updatedTrafego.destino;
    trafego.morador_destino_id = updatedTrafego.morador_destino_id;
    trafego.observacao = updatedTrafego.observacao;
    trafego.user_reg_saida = updatedTrafego.user_reg_saida;
    trafego.saida_automatica = updatedTrafego.saida_automatica;
    trafego.dataSaida = updatedTrafego.dataSaida;
    trafego.portaria_entrada_id = updatedTrafego.portaria_entrada_id;
    trafego.portaria_saida_id = updatedTrafego.portaria_saida_id;

    if (updatedTrafego.image) {
      trafego.image = updatedTrafego.image;
    }
    if (updatedTrafego.imagem_thumb) {
      trafego.imagem_thumb = updatedTrafego.imagem_thumb;
    }
    if (updatedTrafego.imagem_placa) {
      trafego.imagem_placa = updatedTrafego.imagem_placa;
    }
    if (updatedTrafego.image_saida) {
      trafego.image_saida = updatedTrafego.image_saida;
    }
    if (updatedTrafego.imagem_saida_thumb) {
      trafego.imagem_saida_thumb = updatedTrafego.imagem_saida_thumb;
    }
    if (updatedTrafego.imagem_saida_placa) {
      trafego.imagem_saida_placa = updatedTrafego.imagem_saida_placa;
    }

    console.log('trafego Updated: ', trafego);

    return await trafego.save();
  } else {
    throw Error('Operation not allowed');
  }
};

const updateTrafegoDB = async (loggedUserId, updatedTrafego) => {
  // usuário cliente só pode atualizar trafego no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const trafego = await Trafego.findByPk(updatedTrafego.id);
  if (!trafego) {
    throw Error('Trafego informado não existe');
  }
  if (
    loggedUser.admin ||
    loggedUser.client_id === trafego.client_id // cliente não pode cadastrar trafego em outro cliente
  ) {
    return await updatedTrafego.save();
  } else {
    throw Error('Operation not allowed');
  }
};

const remove = async (loggedUserId, removedTrafegoId) => {
  // usuários cliente só pode remover trafegos no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const trafego = await Trafego.findByPk(removedTrafegoId);
  if (!trafego) {
    throw Error('Trafego informado não existe');
  }

  if (loggedUser.admin || loggedUser.client_id === removedTrafegoId.client_id) {
    return await Trafego.destroy({
      where: {
        id: removedTrafegoId,
      },
    });
  } else {
    throw Error('Operation not allowed');
  }
};

const obterRegistroEntradaSemSaida = async (loggedUserId, placa) => {
  console.log('------------------------------');
  console.log(' obterRegistroEntradaSemSaida ');
  console.log('------------------------------\n\n');
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  let trafegoEntrada = null;
  if (
    loggedUser.admin ||
    loggedUser.client_id === trafego.client_id // cliente não pode cadastrar trafego em outro cliente
  ) {
    const params = {
      logging: console.log, // log SQL statement to console
      where: {
        placa,
        imagem_saida: null,
      },
      order: [['id', 'DESC']],
    };
    // somente a placa exata: leituras com erro de OCR não são casadas por aproximação e ficam como
    // saída sem entrada identificada, para o operador associar na tela
    trafegoEntrada = await Trafego.findOne(params);
    console.log(placa, ' - Obtendo Registro Entrada - placa completa: ', trafegoEntrada);
  }
  return trafegoEntrada;
};

const updateWhiteList = async (loggedUserId, veiculo) => {
  // coloca para null todas as associações com o veículo
  await Trafego.update({ whitelist_id: null }, { where: { whitelist_id: veiculo.id } });

  // associa novamente com a placa do veiculo
  const ret = await Trafego.update(
    { whitelist_id: veiculo.id, in_whitelist: true },
    { where: { placa: veiculo.placa } }
  );
  console.log(ret);
};

const removeWhiteList = async (veiculoId) => {
  // coloca para null todas as associações com o veículo
  await Trafego.update({ whitelist_id: null }, { where: { whitelist_id: veiculoId } });
};

const updateBlackList = async (loggedUserId, veiculo) => {
  // coloca para null todas as associações com o veículo
  await Trafego.update({ blacklist_id: null }, { where: { blacklist_id: veiculo.id } });

  // associa novamente com a placa do veiculo
  const ret = await Trafego.update(
    { blacklist_id: veiculo.id, in_blacklist: true },
    { where: { placa: veiculo.placa } }
  );
  console.log(ret);
};

const removeBlackList = async (veiculoId) => {
  // coloca para null todas as associações com o veículo
  await Trafego.update({ blacklist_id: null }, { where: { blacklist_id: veiculoId } });
};

module.exports = {
  linhaDoTempo,
  registrarSaidaManualAntigas,
  listarSemSaida,
  listarComSaida,
  listarPorStatus,
  aplicarSaidaNoTrafego,
  listPorPeriodo,
  get,
  insert,
  update,
  updateTrafegoDB,
  remove,
  obterRegistroEntradaSemSaida,
  updateWhiteList,
  removeWhiteList,
  updateBlackList,
  removeBlackList,
};
