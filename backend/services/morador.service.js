'use strict';
const { Morador, User } = require('../models');

const list = async (loggedUserId, clientId) => {
  // se é admin, pode listar todos
  // se é admin do cliente, só pode listar os moradores do cliente
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
    return await Morador.findAll(where);
  } else {
    return [];
  }
};

const get = async (loggedUserId, id) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const morador = await Morador.findByPk(id);
  if (!morador) {
    throw Error('Morador informado não existe');
  }
  if (loggedUser.admin || (loggedUser.client_id === morador.client_id && morador.client_id === loggedUser.client_id)) {
    return morador;
  } else {
    throw Error('Operation not allowed');
  }
};

const insert = async (loggedUserId, newMorador) => {
  // somente admin ou admin cliente pode cadastrar cliente
  // admin cliente só pode cadastrar no mesmo cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }

  if (loggedUser.admin || loggedUser.client_id === newMorador.client_id) {
    return await Morador.create(newMorador);
  } else {
    throw Error('Operation not allowed');
  }
};

const update = async (loggedUserId, updatedMorador) => {
  // somente admin ou admin cliente pode atualizar cliente
  // admin cliente só pode atualizar moradores no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const camera = await Morador.findByPk(updatedMorador.id);
  if (!camera) {
    throw Error('Morador informado não existe');
  }
  if (
    loggedUser.admin ||
    (loggedUser.client_id === camera.client_id && camera.client_id === updatedMorador.client_id) // cliente não pode cadastrar camera em outro cliente
  ) {
    return await Morador.update(updatedMorador, { where: { id: updatedMorador.id } });
  } else {
    throw Error('Operation not allowed');
  }
};

const remove = async (loggedUserId, removedMoradorId) => {
  // somente admin ou admin cliente pode remover moradores
  // admin cliente só pode remover moradores no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const camera = await Morador.findByPk(removedMoradorId);
  if (!camera) {
    throw Error('Morador informado não existe');
  }

  if (loggedUser.admin || loggedUser.client_id === removedMoradorId.client_id) {
    return await Morador.destroy({
      where: {
        id: removedMoradorId,
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
