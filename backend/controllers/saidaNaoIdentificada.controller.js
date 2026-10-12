const saidaNaoIdentificadaService = require('../services/saidaNaoIdentificada.service');

class SaidaNaoIdentificadaController {
  /**
   * Lista as saídas não identificadas do cliente
   */
  async listarPorCliente(loggedUserId, clientId, filtros) {
    return await saidaNaoIdentificadaService.listarPorCliente(loggedUserId, clientId, filtros);
  }

  /**
   * Lista as saídas da última hora: as associadas a uma entrada e as pendentes
   */
  async listarRecentes(loggedUserId, clientId) {
    return await saidaNaoIdentificadaService.listarRecentes(loggedUserId, clientId);
  }

  /**
   * Arquiva as saídas pendentes com mais de 2 horas (somente administradores)
   */
  async arquivarAntigas(loggedUserId, clientId) {
    return await saidaNaoIdentificadaService.arquivarAntigas(loggedUserId, clientId);
  }

  /**
   * Arquiva uma saída sem associá-la a uma entrada
   */
  async arquivar(loggedUserId, id, motivo) {
    return await saidaNaoIdentificadaService.arquivar(loggedUserId, id, motivo);
  }

  /**
   * Desfaz a associação automática de uma saída com uma entrada de placa próxima
   */
  async desassociar(loggedUserId, id) {
    return await saidaNaoIdentificadaService.desassociar(loggedUserId, id);
  }

  /**
   * Associa uma saída não identificada a uma entrada sem saída
   */
  async associar(loggedUserId, id, trafegoId) {
    return await saidaNaoIdentificadaService.associar(loggedUserId, id, trafegoId);
  }
}

module.exports = new SaidaNaoIdentificadaController();
