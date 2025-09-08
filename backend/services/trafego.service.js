'use strict';

const { Op } = require('sequelize');
const { Trafego, User } = require('../models');
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
          dataSaida: {
            [Op.not]: null,
          },
        },
        limit: 40,
      };
    }
    return await Trafego.findAll(params);
  } else {
    return [];
  }
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
    return await Trafego.findAll(params);
  } else {
    throw Error('Operation not allowed');
  }
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

function isNumeric(val) {
  return /^-?\d+$/.test(val);
}

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
    let params = {
      logging: console.log, // log SQL statement to console
      where: {
        placa,
        imagem_saida: null,
      },
      order: [['id', 'DESC']],
    };
    trafegoEntrada = await Trafego.findOne(params);
    console.log(placa, ' - Obtendo Registro Entrada - placa completa: ', trafegoEntrada);

    let ultimosDigitos = placa.substring(3);
    if (!trafegoEntrada) {
      // tentar pesquisar pelos 4 ultimos dígitos
      params = {
        logging: console.log, // log SQL statement to console
        where: {
          placa: { [Op.like]: `%${ultimosDigitos}` },
          imagem_saida: null,
        },
        order: [['id', 'DESC']],
      };
      trafegoEntrada = await Trafego.findOne(params);
      console.log(placa, ' - Obtendo Registro Entrada - somente número da placa: ', trafegoEntrada);
    }

    // verifica se o 5 dígito é O, I ou S, e troca por 0, 1 e 5 respectivamente
    if (!trafegoEntrada) {
      if (!isNumeric(placa[4])) {
        if (placa[4] == 'O') {
          // igual a letra "O" (ó maiusculo)
          ultimosDigitos = `${ultimosDigitos[0]}0${ultimosDigitos.substring(2)}`;
        } else if (placa[4] == 'I') {
          // igual a letra "I"
          ultimosDigitos = `${ultimosDigitos[0]}1${ultimosDigitos.substring(2)}`;
        } else if (placa[4] == 'S') {
          // igual a letra "S"
          ultimosDigitos = `${ultimosDigitos[0]}5${ultimosDigitos.substring(2)}`;
        }
      }
      // tentar pesquisar pelos 4 ultimos dígitos
      params = {
        logging: console.log, // log SQL statement to console
        where: {
          placa: { [Op.like]: `%${ultimosDigitos}` },
          imagem_saida: null,
        },
        order: [['id', 'DESC']],
      };
      trafegoEntrada = await Trafego.findOne(params);
      console.log(placa, ' - Obtendo Registro Entrada - somente número da placa, com substituições: ', trafegoEntrada);
    }

    // considerando os 3 primeiros digitos e os ultimos 2 digitos da placa
    if (!trafegoEntrada) {
      const placaInicio = placa.substring(0, 3);
      const placaFim = placa.substring(placa.length - 2);
      // tentar pesquisar pelos 4 ultimos dígitos
      params = {
        logging: console.log, // log SQL statement to console
        where: {
          placa: { [Op.like]: `${placaInicio}%${placaFim}` },
          imagem_saida: null,
        },
        order: [['id', 'DESC']],
      };
      trafegoEntrada = await Trafego.findOne(params);
      console.log(
        placa,
        ' - Obtendo Registro Entrada - somente inicio (3 digitos) e fim (2 digidos) ',
        trafegoEntrada,
        params
      );
    }
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
  listarSemSaida,
  listarComSaida,
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
