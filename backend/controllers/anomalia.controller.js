const consulta = require('../services/anomalia/consulta');

class AnomaliaController {
  /**
   * Lista os alertas de anomalia do cliente
   */
  async listar(loggedUserId, clientId, filtros) {
    return await consulta.listar(loggedUserId, clientId, filtros);
  }

  /**
   * Obtem um alerta com evidências e revisões
   */
  async obter(loggedUserId, id) {
    return await consulta.obter(loggedUserId, id);
  }

  /**
   * Histórico estatístico de uma placa no cliente
   */
  async historicoDaPlaca(loggedUserId, clientId, placa) {
    return await consulta.historicoDaPlaca(loggedUserId, clientId, placa);
  }

  /**
   * Sinais dos cards de veículo: último alerta não descartado e primeira passagem de cada placa
   */
  async sinaisDasPlacas(loggedUserId, clientId, pedido) {
    return await consulta.sinaisDasPlacas(loggedUserId, clientId, pedido);
  }

  /**
   * Registra a revisão humana de um alerta
   */
  async revisar(loggedUserId, id, revisao) {
    return await consulta.revisar(loggedUserId, id, revisao);
  }

  /**
   * Métricas do detector de anomalias
   */
  async metricas(loggedUserId, clientId, dias) {
    return await consulta.metricas(loggedUserId, clientId, dias);
  }
}

module.exports = new AnomaliaController();
