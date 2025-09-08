'use strict';
const { SaidaNaoIdentificada, User, Camera } = require('../models');

const list = async (cameraId) => {
  let params = {};
  if (cameraId) {
    params = {
      where: {
        camera_id: cameraId,
      },
    };
  }
  // params.attributes = { exclude: ['imagem_placa', 'imagem_carro'] };
  params.order = [['id', 'ASC']];
  const saidasNaoIdentificadas = await SaidaNaoIdentificada.findAll(params);
  return saidasNaoIdentificadas;
};

const get = async (id) => {
  return await SaidaNaoIdentificada.findByPk(id);
};

const getByIdentificadorPlaca = async (identificador_placa) => {
  let params = {
    where: {
      identificador_placa,
    },
  };

  return await SaidaNaoIdentificada.findOne(params);
};

const insert = async (newSaidaNaoIdentificada) => {
  console.log('newSaidaNaoIdentificada:', newSaidaNaoIdentificada);
  const newSaidaNaoIdentificadaDb = await SaidaNaoIdentificada.create(newSaidaNaoIdentificada);
  return { id: newSaidaNaoIdentificadaDb.id };
};

module.exports = {
  list,
  get,
  insert,
  getByIdentificadorPlaca,
};
