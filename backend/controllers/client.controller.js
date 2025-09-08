const clientService = require('../services/client.service');

class ClientController {
  /**
   * Get all clients
   */
  async listClients(loggedUserId) {
    return await clientService.list(loggedUserId);
  }

  /**
   * Get a client
   */
  async getClient(loggedUserId, id) {
    return await clientService.get(loggedUserId, id);
  }

  /**
   * Insert a client
   */
  async insertClient(loggedUserId, newClient) {
    return await clientService.insert(loggedUserId, newClient);
  }

  /**
   * Update a client
   */
  async updateClient(loggedUserId, client) {
    return await clientService.update(loggedUserId, client);
  }

  /**
   * Remove a client
   */
  async removeClient(loggedUserId, clientId) {
    return await clientService.remove(loggedUserId, clientId);
  }
}

module.exports = new ClientController();
