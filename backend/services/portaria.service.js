'use strict';
const { Portaria, User } = require('../models');

const list = async (loggedUserId, clientId) => {
  // se é admin, pode listar todos
  // se é admin do cliente, só pode listar as portarias do cliente
  // se não é nenhum tipo de admin, não lista nada
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin || loggedUser.client_id === clientId) {
    let where = {};
    if (clientId) {
      where = {
        where: {
          client_id: clientId,
        },
      };
    }
    return await Portaria.findAll(where);
  } else {
    return [];
  }
};

const get = async (loggedUserId, id) => {
  // só admin pode listar todos clientes
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin) {
    return await Portaria.findByPk(id);
  } else {
    throw Error('Operation not allowed');
  }
};

const insert = async (loggedUserId, newPortaria) => {
  // somente admin ou admin cliente pode cadastrar
  // admin cliente só pode cadastrar no mesmo cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }

  if (loggedUser.admin || loggedUser.client_id === newPortaria.client_id) {
    return await Portaria.create(newPortaria);
  } else {
    throw Error('Operation not allowed');
  }
};

const update = async (loggedUserId, updatedPortaria) => {
  // somente admin ou admin cliente pode atualizar cliente
  // admin cliente só pode atualizar portarias no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const portaria = await Portaria.findByPk(updatedPortaria.id);
  if (!portaria) {
    throw Error('Portaria informada não existe');
  }
  if (
    loggedUser.admin ||
    (loggedUser.client_id === portaria.client_id && portaria.client_id === updatedPortaria.client_id) // cliente não pode cadastrar portaria em outro cliente
  ) {
    return await Portaria.update(updatedPortaria, { where: { id: updatedPortaria.id } });
  } else {
    throw Error('Operation not allowed');
  }
};

const remove = async (loggedUserId, removedPortariaId) => {
  // somente admin ou admin cliente pode remover portarias
  // admin cliente só pode remover portarias no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const portaria = await Portaria.findByPk(removedPortariaId);
  if (!portaria) {
    throw Error('Câmera informada não existe');
  }

  if (loggedUser.admin || loggedUser.client_id === removedPortariaId.client_id) {
    return await Portaria.destroy({
      where: {
        id: removedPortariaId,
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
