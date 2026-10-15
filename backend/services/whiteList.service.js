'use strict';
const { Op } = require('sequelize');
const { User, WhiteList } = require('../models');
const { placaCorrigidaPelaGreenList } = require('./placaUtil');

const TAMANHO_PAGINA_PADRAO = 50;

/**
 * Lista os veículos. "texto" filtra por placa, nome, marca ou modelo (contém, sem diferenciar maiúsculas).
 * Com "page", retorna { rows, total, page, pageSize }; sem ele, o array completo, como antes.
 */
const list = async (loggedUserId, clientId, { texto, page, pageSize } = {}) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else {
    const paginado = !!page;
    const tamanho = pageSize || TAMANHO_PAGINA_PADRAO;
    if (loggedUser.admin || loggedUser.client_id === clientId) {
      const where = {};
      if (clientId) {
        where.client_id = clientId;
      }
      const termo = (texto || '').trim();
      if (termo) {
        const contem = { [Op.like]: `%${termo.replace(/[\\%_]/g, '\\$&')}%` };
        where[Op.or] = [{ placa: contem }, { nome: contem }, { marca: contem }, { modelo: contem }];
      }
      if (!paginado) {
        return await WhiteList.findAll({ where });
      }
      const { rows, count } = await WhiteList.findAndCountAll({
        where,
        order: [['id', 'ASC']],
        limit: tamanho,
        offset: (page - 1) * tamanho,
      });
      return { rows, total: count, page, pageSize: tamanho };
    } else {
      return paginado ? { rows: [], total: 0, page, pageSize: tamanho } : [];
    }
  }
};

const get = async (loggedUserId, id) => {
  const loggedUser = await User.findByPk(loggedUserId);
  const whiteList = await WhiteList.findByPk(id);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin || loggedUser.client_id === whiteList.client_id) {
    return whiteList;
  } else {
    throw Error('Operation not allowed');
  }
};

const insert = async (loggedUserId, newWhiteList) => {
  newWhiteList.user_id = loggedUserId;
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  if (loggedUser.admin || loggedUser.client_id === newWhiteList.client_id) {
    return await WhiteList.create(newWhiteList);
  } else {
    throw Error('Operation not allowed');
  }
};

const update = async (loggedUserId, updatedWhiteList) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const whiteList = await WhiteList.findByPk(updatedWhiteList.id);
  if (!whiteList) {
    throw Error('veículo informada não existe');
  }
  if (loggedUser.admin || loggedUser.client_id === whiteList.client_id) {
    return await WhiteList.update(updatedWhiteList, { where: { id: updatedWhiteList.id } });
  } else {
    throw Error('Operation not allowed');
  }
};

const remove = async (loggedUserId, removedWhiteListId) => {
  // o próptio usuário não pode se remover
  // somente admin ou admin cliente pode remover cliente
  // admin cliente só pode atualizar usuários no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const user = await WhiteList.findByPk(removedWhiteListId);
  if (!user) {
    throw Error('Veículo informado não existe');
  }

  if (loggedUser.admin || loggedUser.client_id === user.client_id) {
    return await WhiteList.destroy({
      where: {
        id: removedWhiteListId,
      },
    });
  } else {
    throw Error('Operation not allowed');
  }
};

const findByPlaca = async (loggedUserId, clientId, placa) => {
  console.log('==== pesquisando placa: ', placa);
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else {
    if (loggedUser.admin || loggedUser.client_id === clientId) {
      let where = {};
      where = {
        where: {
          client_id: clientId,
          placa,
        },
      };
      return await WhiteList.findOne(where);
    } else {
      return [];
    }
  }
};

/**
 * Placa da green list do cliente que difere em 1 caractere da placa lida pela câmera (erro de leitura),
 * ou null quando não há correção a fazer. Ver placaCorrigidaPelaGreenList.
 */
const obterPlacaCorrigida = async (clientId, placa) => {
  const veiculos = await WhiteList.findAll({ attributes: ['placa'], where: { client_id: clientId }, raw: true });
  return placaCorrigidaPelaGreenList(placa, veiculos.map((veiculo) => veiculo.placa));
};

module.exports = {
  list,
  get,
  insert,
  update,
  remove,
  findByPlaca,
  obterPlacaCorrigida,
};
