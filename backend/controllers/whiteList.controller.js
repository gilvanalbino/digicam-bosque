const whiteListService = require('../services/whiteList.service');
const trafegoService = require('../services/trafego.service');

class WhiteListController {
  /**
   * Get all whiteList
   */
  async listWhiteList(loggedUserId) {
    return await whiteListService.list(loggedUserId);
  }

  /**
   * Get all whiteList by client_id
   */
  async listWhiteListByClientId(loggedUserId, clientId) {
    return await whiteListService.list(loggedUserId, clientId);
  }

  /**
   * Get a whiteList
   */
  async getWhiteList(loggedUserId, id) {
    return await whiteListService.get(loggedUserId, id);
  }

  /**
   * Insert a whiteList
   */
  async insertWhiteList(loggedUserId, newWhiteList) {
    return new Promise(async (resolve, reject) => {
      try {
        const veiculo = await whiteListService.insert(loggedUserId, newWhiteList);
        await trafegoService.updateWhiteList(loggedUserId, veiculo);
        resolve(veiculo);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Update a whiteList
   */
  async updateWhiteList(loggedUserId, whiteList) {
    return new Promise(async (resolve, reject) => {
      try {
        const ret = await whiteListService.update(loggedUserId, whiteList);
        await trafegoService.updateWhiteList(loggedUserId, whiteList);
        resolve(ret);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Remove a whiteList
   */
  async removeWhiteList(loggedUserId, whiteListId) {
    return new Promise(async (resolve, reject) => {
      try {
        trafegoService.removeWhiteList(whiteListId);
        const ret = await whiteListService.remove(loggedUserId, whiteListId);
        resolve(ret);
      } catch (error) {}
    });
  }
}

module.exports = new WhiteListController();
