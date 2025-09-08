'use strict';
const { Client, User } = require('../models');

const list = async (loggedUserId) => {
  // só admin pode listar todos clientes
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else {
    return await Client.findAll({});
  }
};

const get = async (loggedUserId, id) => {
  // só admin pode listar todos clientes
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin) {
    return await Client.findByPk(id);
  } else {
    throw Error('Operation not allowed');
  }
};

const insert = async (loggedUserId, newClient) => {
  // somente admin pode cadastrar cliente
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin) {
    return await Client.create(newClient);
  } else {
    throw Error('Operation not allowed');
  }
};

const update = async (loggedUserId, updatedClient) => {
  // somente admin pode atualizar cliente
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  if (loggedUser.admin) {
    return await Client.update(updatedClient, { where: { id: updatedClient.id } });
  } else {
    throw Error('Operation not allowed');
  }
};

const remove = async (loggedUserId, removeClientId) => {
  // somente admin pode remover cliente
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin) {
    return await Client.destroy({
      where: {
        id: removeClientId,
      },
    });
  } else {
    throw Error('Operation not allowed');
  }
};

module.exports = {
  list,
  get,
  insert,
  update,
  remove,
};
