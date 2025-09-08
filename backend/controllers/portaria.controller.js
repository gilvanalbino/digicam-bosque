const portariaService = require('../services/portaria.service');

class PortariaController {
  /**
   * Get all portarias
   */
  async listPortarias(loggedUserId) {
    return await portariaService.list(loggedUserId);
  }

  /**
   * Get all portarias by client_id
   */
  async listPortariasByClientId(loggedUserId, clientId) {
    return await portariaService.list(loggedUserId, clientId);
  }

  /**
   * Get a portaria
   */
  async getPortaria(loggedUserId, id) {
    return await portariaService.get(loggedUserId, id);
  }

  /**
   * Insert a portaria
   */
  async insertPortaria(loggedUserId, newPortaria) {
    return await portariaService.insert(loggedUserId, newPortaria);
  }

  /**
   * Update a portaria
   */
  async updatePortaria(loggedUserId, portaria) {
    return await portariaService.update(loggedUserId, portaria);
  }

  /**
   * Remove a portaria
   */
  async removePortaria(loggedUserId, portariaId) {
    return await portariaService.remove(loggedUserId, portariaId);
  }
}

module.exports = new PortariaController();
