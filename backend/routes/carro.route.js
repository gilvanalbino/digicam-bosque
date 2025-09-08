const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const carroController = require('../controllers/carro.controller');
const Joi = require('joi');

class CarroRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Rota para listagem de carros
   */
  list() {
    return {
      path: `/${this.context}/carros`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return carroController.listCarros(request.loggedUserId);
        },
        description: 'Obtem todos os carros cadastrados',
        notes: 'Obtem a lista de todos os carros cadastrados no sistema',
        tags: ['api', 'carros'],
        validate: {
          headers: Joi.object({
            authorization: Joi.string().required(),
          }).unknown(),
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }

  insert() {
    return {
      path: `/${this.context}/carros`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await carroController.insertCarro(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Cria um carro na base de dados',
        notes: 'Um carro é criado na base de dados',
        tags: ['api', 'carros'],
        validate: {
          payload: schemas.carroSchema,
          headers: Joi.object({
            authorization: Joi.string().required(),
          }).unknown(),
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }

  update() {
    return {
      path: `/${this.context}/carros`,
      method: 'PUT',
      options: {
        handler: async (request, h) => {
          try {
            return await carroController.updateCarro(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Atualiza um carro na base de dados',
        notes: 'Um carro é atualizado na base de dados',
        tags: ['api', 'carros'],
        validate: {
          payload: schemas.carroSavedSchema,
          headers: Joi.object({
            authorization: Joi.string().required(),
          }).unknown(),
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }

  delete() {
    return {
      path: `/${this.context}/carros/{id}`,
      method: 'DELETE',
      options: {
        handler: async (request, h) => {
          try {
            return await carroController.removeCarro(request.loggedUserId, request.params.id);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Remove um carro da base de dados',
        notes: 'Um carro é deletado da base de dados',
        tags: ['api', 'carros'],
        validate: {
          params: Joi.object({
            id: Joi.number(),
          }),
          headers: Joi.object({
            authorization: Joi.string().required(),
          }).unknown(),
        },
        response: {
          schema: schemas.response,
          failAction: 'log',
        },
      },
    };
  }
}

module.exports = CarroRoutes;
