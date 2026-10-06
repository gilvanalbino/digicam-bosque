const saidaNaoIdentificadaService = require('../services/saidaNaoIdentificada.service');

class SaidaNaoIdentificadaController {
  /**
   * Lista as saídas não identificadas do cliente
   */
  async listarPorCliente(loggedUserId, clientId, filtros) {
    return await saidaNaoIdentificadaService.listarPorCliente(loggedUserId, clientId, filtros);
  }

  /**
   * Arquiva uma saída sem associá-la a uma entrada
   */
  async arquivar(loggedUserId, id, motivo) {
    return await saidaNaoIdentificadaService.arquivar(loggedUserId, id, motivo);
  }

  /**
   * Associa uma saída não identificada a uma entrada sem saída
   */
  async associar(loggedUserId, id, trafegoId) {
    return await saidaNaoIdentificadaService.associar(loggedUserId, id, trafegoId);
  }
}

module.exports = new SaidaNaoIdentificadaController();
