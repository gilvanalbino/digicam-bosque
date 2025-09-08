const trafegoService = require('../services/trafego.service');
const logIdentificacaoService = require('../services/logIdentificacao.service');
const fileService = require('../services/file.service');

class TrafegoController {
  /**
   * Get all trafegos
   */
  async listTrafegos(loggedUserId) {
    return await trafegoService.list(loggedUserId);
  }

  /**
   * Get all trafegos by client_id
   */
  async listTrafegosByClientId(loggedUserId, clientId) {
    return await trafegoService.listarSemSaida(loggedUserId, clientId);
  }

  /**
   * Get all trafegos by client_id
   */
  async listTrafegosByClientIdRegistrosComSaida(loggedUserId, clientId) {
    return await trafegoService.listarComSaida(loggedUserId, clientId);
  }

  /**
   * Get a trafego
   */
  async getTrafego(loggedUserId, id) {
    return await trafegoService.get(loggedUserId, id);
  }

  /**
   * Insert a trafego
   */
  insertTrafego(loggedUserId, newTrafego) {
    return new Promise(async (resolve, reject) => {
      try {
	console.log("\n==**** INSERT TRAFEGO ======\n"); 
	console.log(newTrafego);

        const now = new Date();

        if (newTrafego.logIdentificacaoId) {
          console.log('---- criando registro à partir da identificação da placa');
          console.log('logIdentificacaoId: ', newTrafego.logIdentificacaoId);
          const logIdentificacao = await logIdentificacaoService.get(newTrafego.logIdentificacaoId);
          console.log('logIdentificacao: ', logIdentificacao);
          newTrafego.imagem = logIdentificacao.imagem_carro;
          newTrafego.imagem_placa = logIdentificacao.imagem_placa;
          newTrafego.identificador_placa = logIdentificacao.identificador_placa;
        }

        console.log('salvando imagem do carro');
        const folder = `/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
        const filename = `${newTrafego.placa}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;

        // Salvar imagem no diretório local
        await fileService.saveFile(newTrafego.imagem, folder, filename, true);

        newTrafego.imagem = `${folder}/${filename}.jpg`;
        newTrafego.imagem_thumb = `${folder}/${filename}_thumb.jpg`;

        if (newTrafego.imagem_placa) {
          console.log('salvando imagem da placa');

          // Salvar imagem no diretório local
          await fileService.saveFile(newTrafego.imagem_placa, folder, filename + '-placa', false);

          newTrafego.imagem_placa = `${folder}/${filename}-placa.jpg`;
        }

        console.log('newTrafego: ', newTrafego);

        const ret = await trafegoService.insert(loggedUserId, newTrafego);

        if (newTrafego.logIdentificacaoId) {
          console.log('Removendo logIdentificacao usado para criar o trafego');
          await logIdentificacaoService.remove(loggedUserId, newTrafego.logIdentificacaoId);
        }

        resolve(ret);
      } catch (error) {
        console.log('****** Error UBSERT TRAFEGI: ', error);
        reject(error);
      }
    });
  }

  /**
   * Update a trafego
   */
  async updateTrafego(loggedUserId, trafego) {
    return await trafegoService.update(loggedUserId, trafego);
  }

  /**
   * Remove a trafego
   */
  async removeTrafego(loggedUserId, trafegoId) {
    return await trafegoService.remove(loggedUserId, trafegoId);
  }

  /**
   * Registra saída manual
   */
  async registrarSaidaManual(loggedUserId, trafegoId, portariaId) {
    const trafego = await trafegoService.get(loggedUserId, trafegoId);
    trafego.dataSaida = new Date();
    trafego.user_reg_saida = loggedUserId;
    trafego.portaria_saida_id = portariaId;
    trafego.saida_automatica = false;
    return await trafegoService.update(loggedUserId, trafego);
  }
}

module.exports = new TrafegoController();
