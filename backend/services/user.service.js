'use strict';
const { User } = require('../models');

const list = async (loggedUserId, clientId) => {
  // se é admin pode listar todos
  // se é admin do cliente, só pode listar os usuários do cliente
  // se não é nenhum tipo de admin, não lista nada
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin || loggedUser.admin_client) {
    if (loggedUser.admin || loggedUser.client_id === clientId) {
      let where = {};
      if (clientId) {
        where = {
          where: {
            client_id: clientId,
          },
        };
      }
      return await User.findAll(where);
    } else {
      return [];
    }
  } else {
    return [];
  }
};

const get = async (loggedUserId, id) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin || loggedUser.admin_client) {
    return await User.findByPk(id);
  } else {
    throw Error('Operation not allowed');
  }
};

const insert = async (loggedUserId, newUser) => {
  // somente admin ou admin cliente pode cadastrar cliente
  // admin cliente só pode cadastrar no mesmo cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  if (loggedUser.admin || loggedUser.client_id === newUser.client_id) {
    newUser.password = User.generateHash(newUser.password);
    return await User.create(newUser);
  } else {
    throw Error('Operation not allowed');
  }
};

const update = async (loggedUserId, updatedUser) => {
  // somente admin ou admin cliente pode atualizar cliente
  // admin cliente só pode atualizar usuários no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const user = await User.findByPk(updatedUser.id);
  if (!user) {
    throw Error('Usuário informado não existe');
  }
  if (loggedUser.admin || loggedUser.client_id === user.client_id) {
    if (
      !!updatedUser.password &&
      updatedUser.password !== user.password &&
      !User.validPassword(updatedUser.password, user.password)
    ) {
      console.log('update password: ', loggedUser.password);
      updatedUser.password = User.generateHash(updatedUser.password);
    } else {
      console.log('Removendo campo senha - senha não mudou!');
      delete updatedUser.password;
    }
    return await User.update(updatedUser, { where: { id: updatedUser.id } });
  } else {
    throw Error('Operation not allowed');
  }
};

const remove = async (loggedUserId, removeUserId) => {
  // o próptio usuário não pode se remover
  // somente admin ou admin cliente pode remover cliente
  // admin cliente só pode atualizar usuários no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const user = await User.findByPk(removeUserId);
  if (!user) {
    throw Error('Usuário informado não existe');
  }

  if (loggedUser.id === user.id) {
    throw Error('O próprio usuário não pode se remover');
  } else if (loggedUser.admin || loggedUser.client_id === user.client_id) {
    return await User.destroy({
      where: {
        id: removeUserId,
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
