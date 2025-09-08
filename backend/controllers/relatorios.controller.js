const trafegoService = require('../services/trafego.service');
const excelService = require('../services/excel.service');
const portariaService = require('../services/portaria.service');

class RelatoriosController {
  async listagemTrafego(
    loggedUserId,
    clientId,
    dataHoraInicio,
    dataHoraFim,
    portaria_entrada_id,
    portaria_saida_id,
    texto_placa_nome
  ) {
    return await trafegoService.listPorPeriodo(
      loggedUserId,
      clientId,
      dataHoraInicio,
      dataHoraFim,
      portaria_entrada_id,
      portaria_saida_id,
      texto_placa_nome
    );
  }

  async listagemTrafegoExcel(loggedUserId, clientId, dataHoraInicio, dataHoraFim, portaria_id, texto_placa_nome) {
    const data = await trafegoService.listPorPeriodo(
      loggedUserId,
      clientId,
      dataHoraInicio,
      dataHoraFim,
      portaria_id,
      texto_placa_nome
    );

    const portarias = await portariaService.list(loggedUserId, clientId);

    return excelService.generateTrafegoExcel(data, portarias);
  }
}

module.exports = new RelatoriosController();
