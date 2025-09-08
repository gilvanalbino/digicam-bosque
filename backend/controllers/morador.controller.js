const moradorService = require('../services/morador.service');

class MoradorController {
  /**
   * Get all moradores
   */
  async listMoradores(loggedUserId) {
    return await moradorService.list(loggedUserId);
  }

  /**
   * Get all moradores by client_id
   */
  async listMoradoresByClientId(loggedUserId, clientId) {
    return await moradorService.list(loggedUserId, clientId);
  }

  /**
   * Get a morador
   */
  async getMorador(loggedUserId, id) {
    return await moradorService.get(loggedUserId, id);
  }

  /**
   * Insert a morador
   */
  async insertMorador(loggedUserId, newMorador) {
    return await moradorService.insert(loggedUserId, newMorador);
  }

  /**
   * Update a morador
   */
  async updateMorador(loggedUserId, morador) {
    return await moradorService.update(loggedUserId, morador);
  }

  /**
   * Remove a morador
   */
  async removeMorador(loggedUserId, moradorId) {
    return await moradorService.remove(loggedUserId, moradorId);
  }
}

module.exports = new MoradorController();
