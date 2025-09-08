const carroService = require('../services/carro.service');

class CarroController {
  /**
   * Get all cameras
   */
  async listCarros(loggedUserId) {
    return await carroService.list(loggedUserId);
  }

  /**
   * Insert a camera
   */
  async insertCarro(loggedUserId, newCarro) {
    return await carroService.insert(loggedUserId, newCarro);
  }

  /**
   * Update a camera
   */
  async updateCarro(loggedUserId, camera) {
    return await carroService.update(loggedUserId, camera);
  }

  /**
   * Remove a camera
   */
  async removeCarro(loggedUserId, cameraId) {
    return await carroService.remove(loggedUserId, cameraId);
  }
}

module.exports = new CarroController();
