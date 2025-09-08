const BaseRoute = require('./base/baseRoute');

const schemas = require('./schemas');

const cameraController = require('../controllers/camera.controller');
const Joi = require('joi');

class CameraRoutes extends BaseRoute {
  constructor(context) {
    super();
    this.context = context;
  }

  /**
   * Rota para listagem de cameras
   */
  list() {
    return {
      path: `/${this.context}/cameras`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return cameraController.listCameras(request.loggedUserId);
        },
        description: 'Obtem todos as cadastradas',
        notes: 'Obtem a lista de todos as cameras cadastrados no sistema',
        tags: ['api', 'cameras'],
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

  listByClientId() {
    return {
      path: `/${this.context}/cameras/client/{id}`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          return cameraController.listCamerasByClientId(request.loggedUserId, request.params.id);
        },
        description: 'Obtem todos as cameras cadastradas para o cliente informado',
        notes: 'Obtem a lista de todas as cameras cadastrados no sistema para o clientes informado',
        tags: ['api', 'cameras'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
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

  get() {
    return {
      path: `/${this.context}/cameras/{id}`,
      method: 'GET',
      options: {
        handler: (request, h) => {
          return cameraController.getCamera(request.loggedUserId, request.params.id);
        },
        description: 'Obtem uma camera pelo id',
        notes: 'Obtem uma camera cadastrada no sistema',
        tags: ['api', 'cameras'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
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

  photo() {
    return {
      path: `/${this.context}/cameras/{id}/photo`,
      method: 'GET',
      options: {
        handler: async (request, h) => {
          try {
            const photoBase64 = await cameraController.getPhoto(request.loggedUserId, request.params.id);
            return h.response(photoBase64);
            // .header('Content-length', photoInfo.contentLength);
          } catch (error) {
            console.log('erro: ', error);
          }
        },
        description: 'Obtem uma imagem instantanea da camera identificada pelo id informado',
        notes: 'Obtem uma imagem de uma camera cadastrada no sistema',
        tags: ['api', 'cameras'],
        validate: {
          params: Joi.object({
            id: Joi.number().required(),
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

  insert() {
    return {
      path: `/${this.context}/cameras`,
      method: 'POST',
      options: {
        handler: async (request, h) => {
          try {
            return await cameraController.insertCamera(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Cria uma camera na base de dados',
        notes: 'Uma camera é criada na base de dados',
        tags: ['api', 'cameras'],
        validate: {
          payload: schemas.cameraSchema,
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
      path: `/${this.context}/cameras`,
      method: 'PUT',
      options: {
        handler: async (request, h) => {
          try {
            return await cameraController.updateCamera(request.loggedUserId, request.payload);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Atualiza uma camera na base de dados',
        notes: 'Um camera é atualizada na base de dados',
        tags: ['api', 'cameras'],
        validate: {
          payload: schemas.cameraSavedSchema,
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
      path: `/${this.context}/cameras/{id}`,
      method: 'DELETE',
      options: {
        handler: async (request, h) => {
          try {
            return await cameraController.removeCamera(request.loggedUserId, request.params.id);
          } catch (error) {
            console.error(error);
            throw error;
          }
        },
        description: 'Remove uma camera da base de dados',
        notes: 'Uma camera é deletada da base de dados',
        tags: ['api', 'cameras'],
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

module.exports = CameraRoutes;
