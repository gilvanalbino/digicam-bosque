const blackListService = require('../services/blackList.service');
const trafegoService = require('../services/trafego.service');

class BlackListController {
  /**
   * Get all blackList
   */
  async listBlackList(loggedUserId) {
    return await blackListService.list(loggedUserId);
  }

  /**
   * Get all blackList by client_id
   */
  async listBlackListByClientId(loggedUserId, clientId) {
    return await blackListService.list(loggedUserId, clientId);
  }

  /**
   * Get a blackList
   */
  async getBlackList(loggedUserId, id) {
    return await blackListService.get(loggedUserId, id);
  }

  /**
   * Insert a blackList
   */
  async insertBlackList(loggedUserId, newBlackList) {
    return new Promise(async (resolve, reject) => {
      try {
        const veiculo = await blackListService.insert(loggedUserId, newBlackList);
        await trafegoService.updateBlackList(loggedUserId, veiculo);
        resolve(veiculo);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Update a blackList
   */
  async updateBlackList(loggedUserId, blackList) {
    return new Promise(async (resolve, reject) => {
      try {
        const ret = await blackListService.update(loggedUserId, blackList);
        await trafegoService.updateBlackList(loggedUserId, blackList);
        resolve(ret);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Remove a blackList
   */
  async removeBlackList(loggedUserId, blackListId) {
    return new Promise(async (resolve, reject) => {
      try {
        trafegoService.removeBlackList(blackListId);
        const ret = await blackListService.remove(loggedUserId, blackListId);
        resolve(ret);
      } catch (error) {}
    });
  }
}

module.exports = new BlackListController();
