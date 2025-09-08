'use strict';
const { LogIdentificacao, User, Camera } = require('../models');

const list = async (loggedUserId, cameraId) => {
  // se é admin, pode listar todos
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  } else if (loggedUser.admin || (loggedUser.client_id && loggedUser.client_id === clientId)) {
    let params = {};
    if (cameraId) {
      params = {
        where: {
          camera_id: cameraId,
        },
      };
    }
    // params.attributes = { exclude: ['imagem_placa', 'imagem_carro'] };
    params.attributes = { exclude: ['imagem_carro'] };
    params.order = [['id', 'ASC']];
    const logIdentList = await LogIdentificacao.findAll(params);
    return logIdentList;
  } else {
    throw Error('Operation not allowed');
  }
};

const listByPortariaId = async (loggedUserId, portariaId) => {
  // se é admin, pode listar todos
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  let params = {};
  if (portariaId) {
    params = {
      include: [
        {
          model: Camera,
          require: true,
          where: { portaria_id: portariaId },
        },
      ],
    };
    // params.attributes = { exclude: ['imagem_placa', 'imagem_carro'] };
    params.attributes = { exclude: ['imagem_carro'] };
    params.order = [['id', 'ASC']];
    const logIdentList = await LogIdentificacao.findAll(params);
    return logIdentList;
  } else {
    throw Error('Operation not allowed');
  }
};

const listPendentesDownload = async () => {
  let params = {
    where: {
      imagem_pendente: true,
    },
  };
  const logIdentList = await LogIdentificacao.findAll(params);
  return logIdentList;
};

const get = async (id) => {
  return await LogIdentificacao.findByPk(id);
};

const insert = async (loggedUserId, newLog) => {
  // somente admin pode inserir
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }

  if (loggedUser.admin || (loggedUser.client_id && loggedUser.client_id === clientId)) {
    console.log("newLog", newLog);
    const newLogDb = await LogIdentificacao.create(newLog);
    console.log("newLogDb", newLogDb);
    return { id: newLogDb.id };
  } else {
    throw Error('Operation not allowed');
  }
};

const updateImages = async (loggedUserId, id, imagemPlaca, imagemCarro) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const logIdentDb = await LogIdentificacao.findByPk(id);
  if (!logIdentDb) {
    throw Error('LogIdentificacao informado não existe');
  }
  if (loggedUser.admin || (loggedUser.client_id && loggedUser.client_id === clientId)) {
    logIdentDb.imagem_placa = imagemPlaca;
    logIdentDb.imagem_carro = imagemCarro;
    logIdentDb.imagem_pendente = false;
    return await logIdentDb.save();
  } else {
    throw Error('Operation not allowed');
  }
};

const remove = async (loggedUserId, logId) => {
  // const loggedUser = await User.findByPk(loggedUserId);
  // if (!loggedUser) {
  //   throw Error('Informar usuário logado');
  // }
  // const logIdent = await LogIdentificacao.findByPk(logId);
  // if (!logIdent) {
  //   throw Error('LogIdentificado informado não existe');
  // }

  // if (loggedUser.admin) {
  return await LogIdentificacao.destroy({
    where: {
      id: logId,
    },
  });
  // } else {
  //   throw Error('Operation not allowed');
  // }
};

const getImagemCarro = async (id) => {
  const logIdentDb = await LogIdentificacao.findByPk(id);
  return {
    imagemCarro: logIdentDb.imagem_carro,
  };
};

module.exports = {
  list,
  listByPortariaId,
  get,
  insert,
  updateImages,
  remove,
  listPendentesDownload,
  getImagemCarro,
};
