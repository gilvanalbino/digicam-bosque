'use strict';
const { User, WhiteList } = require('../models');

const list = async (loggedUserId, clientId) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else {
    if (loggedUser.admin || loggedUser.client_id === clientId) {
      let where = {};
      if (clientId) {
        where = {
          where: {
            client_id: clientId,
          },
        };
      }
      return await WhiteList.findAll(where);
    } else {
      return [];
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

module.exports = {
  list,
  get,
  insert,
  update,
  remove,
  findByPlaca,
};
