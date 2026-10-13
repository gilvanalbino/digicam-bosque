'use strict';
const { Op } = require('sequelize');
const { User, BlackList } = require('../models');

const TAMANHO_PAGINA_PADRAO = 50;

/**
 * Lista os veículos. "texto" filtra por placa, motivo, marca ou modelo (contém, sem diferenciar maiúsculas).
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
        where[Op.or] = [{ placa: contem }, { motivo: contem }, { marca: contem }, { modelo: contem }];
      }
      if (!paginado) {
        return await BlackList.findAll({ where });
      }
      const { rows, count } = await BlackList.findAndCountAll({
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
  const whiteList = await BlackList.findByPk(id);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin || loggedUser.client_id === whiteList.client_id) {
    return whiteList;
  } else {
    throw Error('Operation not allowed');
  }
};

const insert = async (loggedUserId, newBlackList) => {
  newBlackList.user_id = loggedUserId;
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  if (loggedUser.admin || loggedUser.client_id === newBlackList.client_id) {
    return await BlackList.create(newBlackList);
  } else {
    throw Error('Operation not allowed');
  }
};

const update = async (loggedUserId, updatedBlackList) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const whiteList = await BlackList.findByPk(updatedBlackList.id);
  if (!whiteList) {
    throw Error('veículo informada não existe');
  }
  if (loggedUser.admin || loggedUser.client_id === whiteList.client_id) {
    return await BlackList.update(updatedBlackList, { where: { id: updatedBlackList.id } });
  } else {
    throw Error('Operation not allowed');
  }
};

const remove = async (loggedUserId, removedBlackListId) => {
  // o próptio usuário não pode se remover
  // somente admin ou admin cliente pode remover cliente
  // admin cliente só pode atualizar usuários no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const user = await BlackList.findByPk(removedBlackListId);
  if (!user) {
    throw Error('Veículo informado não existe');
  }

  if (loggedUser.admin || loggedUser.client_id === user.client_id) {
    return await BlackList.destroy({
      where: {
        id: removedBlackListId,
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
      return await BlackList.findOne(where);
    } else {
      return [];
    }
  }
};

module.exports = {
  list,
  get,
  insert,
  update,
  remove,
  findByPlaca,
};
