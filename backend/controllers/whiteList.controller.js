const whiteListService = require('../services/whiteList.service');
const trafegoService = require('../services/trafego.service');
const whiteListImportacaoService = require('../services/whiteListImportacao.service');

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
  async listWhiteListByClientId(loggedUserId, clientId, filtros) {
    return await whiteListService.list(loggedUserId, clientId, filtros);
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
   * Importa veículos de uma planilha Excel (.xlsx) para a green list do cliente
   */
  async importarWhiteList(loggedUserId, clientId, conteudo) {
    return await whiteListImportacaoService.importar(loggedUserId, clientId, conteudo);
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
