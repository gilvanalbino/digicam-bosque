'use strict';
const { Camera, User } = require('../models');

const list = async (loggedUserId, clientId) => {
  // se é admin, pode listar todos
  // se é admin do cliente, só pode listar as cameras do cliente
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
    return await Camera.findAll(where);
  } else {
    return [];
  }
};

const get = async (loggedUserId, id) => {
  // só admin pode listar todos cameras
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin) {
    return await Camera.findByPk(id);
  } else {
    throw Error('Operation not allowed');
  }
};

const insert = async (loggedUserId, newCamera) => {
  // somente admin ou admin cliente pode cadastrar cliente
  // admin cliente só pode cadastrar no mesmo cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }

  if (loggedUser.admin || loggedUser.client_id === newCamera.client_id) {
    return await Camera.create(newCamera);
  } else {
    throw Error('Operation not allowed');
  }
};

const update = async (loggedUserId, updatedCamera) => {
  // somente admin ou admin cliente pode atualizar cliente
  // admin cliente só pode atualizar cameras no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const camera = await Camera.findByPk(updatedCamera.id);
  if (!camera) {
    throw Error('Camera informada não existe');
  }
  if (
    loggedUser.admin ||
    (loggedUser.client_id === camera.client_id && camera.client_id === updatedCamera.client_id) // cliente não pode cadastrar camera em outro cliente
  ) {
    return await Camera.update(updatedCamera, { where: { id: updatedCamera.id } });
  } else {
    throw Error('Operation not allowed');
  }
};

const remove = async (loggedUserId, removedCameraId) => {
  // somente admin ou admin cliente pode remover cameras
  // admin cliente só pode remover cameras no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const camera = await Camera.findByPk(removedCameraId);
  if (!camera) {
    throw Error('Câmera informada não existe');
  }

  if (loggedUser.admin || loggedUser.client_id === removedCameraId.client_id) {
    return await Camera.destroy({
      where: {
        id: removedCameraId,
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
