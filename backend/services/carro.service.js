'use strict';
const { Carro, Morador, User } = require('../models');
const { sequelize } = require('../models');

const list = async (loggedUserId, clientId) => {
  // se é admin, pode listar todos
  // se é admin do cliente, só pode listar os carros do cliente
  // se não é nenhum tipo de admin, não lista nada
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  if (loggedUser.admin || loggedUser.client_id === clientId) {
    let where = '';
    if (clientId) {
      where = ` AND m.client_id = ${clientId}`;
    }
    return await sequelize.query(`SELECT * FROM Carros c JOIN Moradores m on c.morador_id = m.id WHERE 1=1 ${where}`, {
      model: Carro,
      mapToModel: true, // pass true here if you have any mapped fields
    });
  } else {
    return [];
  }
};

const insert = async (loggedUserId, newCarro) => {
  // somente admin ou admin cliente pode cadastrar cliente
  // admin cliente só pode cadastrar no mesmo cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  // obtem o morador
  const morador = await Morador.findByPk(newCarro.morador_id);
  if (!morador) {
    throw Error('Morador informado não existe');
  }

  if (loggedUser.admin || loggedUser.client_id === morador.client_id) {
    return await Carro.create(newCarro);
  } else {
    throw Error('Operation not allowed');
  }
};

const update = async (loggedUserId, updatedCarro) => {
  // somente admin ou admin cliente pode atualizar cliente
  // admin cliente só pode atualizar carros no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  // obtem o morador
  const morador = await Morador.findByPk(updatedCarro.morador_id);
  if (!morador) {
    throw Error('Morador informado não existe');
  }
  const carro = await Carro.findByPk(updatedCarro.id);
  if (!carro) {
    throw Error('Carro informado não existe');
  }
  if (
    loggedUser.admin ||
    (loggedUser.client_id === carro.client_id && carro.client_id === morador.client_id) // cliente não pode cadastrar carro em outro cliente
  ) {
    return await Carro.update(updatedCarro, { where: { id: updatedCarro.id } });
  } else {
    throw Error('Operation not allowed');
  }
};

const remove = async (loggedUserId, removedCarroId) => {
  // somente admin ou admin cliente pode remover carros
  // admin cliente só pode remover carros no cliente a que pertence
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  const carro = await Carro.findByPk(removedCarroId);
  if (!carro) {
    throw Error('Carro informado não existe');
  }
  // obtem o morador
  const morador = await Morador.findByPk(carro.morador_id);

  if (loggedUser.admin || loggedUser.client_id === morador.client_id) {
    return await Carro.destroy({
      where: {
        id: removedCarroId,
      },
    });
  } else {
    throw Error('Operation not allowed');
  }
};

module.exports = {
  list,
  insert,
  update,
  remove,
};
