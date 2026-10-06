const _ = require('lodash');

const logIdentificacaoService = require('../services/logIdentificacao.service');
const hikvisionService = require('../services/hikVision.service');
const cameraService = require('../services/camera.service');
const ftpService = require('../services/ftp.service');
const trafegoService = require('../services/trafego.service');
const fileService = require('../services/file.service');
const clientService = require('../services/client.service');
const trafegoController = require('./trafego.controller');
const whiteListService = require('../services/whiteList.service');
const blackListService = require('../services/blackList.service');
const databaseService = require('../services/sequelizeDatabaseService');
const saidaNaoIdentificadaService = require('../services/saidaNaoIdentificada.service');
const logidentificacao = require('../models/logidentificacao');
const { Camera } = require('../models');

const gerarIdentificadorUnico = (date, placa) => {
  return `${date.getTime()}-${placa}`;
};

/**
 * Salva em disco as imagens (carro e placa) de uma identificação, retornando os caminhos gravados
 */
const salvarImagensLogIdentificacao = async (logIdentificacao, folder, filename) => {
  const imagens = {};
  if (logIdentificacao.imagem_carro) {
    console.log('salvando imagem do carro');
    await fileService.saveFile(logIdentificacao.imagem_carro, folder, filename, true);
    imagens.imagem = `${folder}/${filename}.jpg`;
    imagens.imagem_thumb = `${folder}/${filename}_thumb.jpg`;
  }
  if (logIdentificacao.imagem_placa) {
    console.log('salvando imagem da placa');
    await fileService.saveFile(logIdentificacao.imagem_placa, folder, filename + '-placa', false);
    imagens.imagem_placa = `${folder}/${filename}-placa.jpg`;
  }
  return imagens;
};

class LogIdentificacaoController {
  /**
   * Get all LogIdentificacao
   */
  async listLogIdentificacao(loggedUserId) {
    return await logIdentificacaoService.list(loggedUserId);
  }

  /**
   * Get all LogIdentificacao by camera_id
   */
  async listLogIdentificacaoByCameraId(loggedUserId, cameraId) {
    return await logIdentificacaoService.list(loggedUserId, cameraId);
  }

  /**
   * Get all LogIdentificacao by portaria_id
   */
  async listLogIdentificacaoByPortariaId(loggedUserId, portariaId) {
    return await logIdentificacaoService.listByPortariaId(loggedUserId, portariaId);
  }

  /**
   * Insert a logIdentificacao
   */
  async insertLogIdentificacao(loggedUserId, newLogIdentificacao) {
    const placaId = gerarIdentificadorUnico(newLogIdentificacao.data, newLogIdentificacao.placa);

    const camera = await cameraService.get(loggedUserId, newLogIdentificacao.camera_id);

    // verifica se placa já foi inserida
    const placaEmLogIdentificacao = await databaseService.obterLogIdentificacaoPlaca(placaId);
    let placaEmTrafego;
    if (camera.sentido === 'E') {
      placaEmTrafego = await databaseService.obterTrafegoEntradaPlaca(placaId);
    } else {
      placaEmTrafego = await databaseService.obterTrafegoSaidaPlaca(placaId);
    }

    if (placaEmLogIdentificacao || placaEmTrafego) {
      console.log(`Placa ${placaId} já inserida anteriormente`);
      return { mensagem: 'Placa já inserida anteriormente' };
    }

    const client = await clientService.get(loggedUserId, camera.client_id);

    newLogIdentificacao.imagem_pendente = true;
    newLogIdentificacao.imagem_placa = null;
    newLogIdentificacao.imagem_carro = null;
    newLogIdentificacao.identificador_placa = placaId;

    // fazendo inicialmente uma baixa manual, para minimizar problemas de download de imagem
    if (camera.sentido === 'S') {
      const trafegoEntrada = await trafegoService.obterRegistroEntradaSemSaida(loggedUserId, newLogIdentificacao.placa);
      if (trafegoEntrada) {
        trafegoEntrada.user_reg_saida = loggedUserId;
        trafegoEntrada.saida_automatica = false;
        trafegoEntrada.dataSaida = new Date();
        trafegoEntrada.placa_saida = newLogIdentificacao.placa;
        trafegoEntrada.identificador_placa_saida = newLogIdentificacao.identificador_placa;
        await trafegoService.updateTrafegoDB(loggedUserId, trafegoEntrada);
      }
    }

    // verifica se está na whiteList
    const whiteList = await whiteListService.findByPlaca(loggedUserId, client.id, newLogIdentificacao.placa);
    if (whiteList) {
      newLogIdentificacao.whiteList_id = whiteList.id;
      newLogIdentificacao.whiteList_nome = whiteList.nome;
      console.log('\n\n CARRO NA GREEN LIST - ', whiteList);
    }

    // verifica se está na blackList
    const blackList = await blackListService.findByPlaca(loggedUserId, client.id, newLogIdentificacao.placa);
    if (blackList) {
      newLogIdentificacao.blackList_id = blackList.id;
      newLogIdentificacao.blackList_motivo = blackList.motivo;
      console.log('\n\n CARRO NA RED LIST - ', blackList);
    }

    // salva o registro no banco, aguarda retorno para retornar para router
    console.log('Inserindo placa:', newLogIdentificacao.placa);
    const ret = await logIdentificacaoService.insert(loggedUserId, newLogIdentificacao);
    console.log('ret:', ret, 'placa:', newLogIdentificacao.placa);

    // solicita download das imagens sem aguardar para não dar "block" na chamada
    const downloadPromise = this.downloadFotosLogIdentificacao(loggedUserId, ret.id);

    // entrada automática
    console.log('==========================================================');
    console.log(
      `Sentido Camera: ${camera.sentido}, Posicionamento: ${camera.posicionamento}, Direção: ${newLogIdentificacao.sentido}`
    );
    console.log('==========================================================');
    if (camera.sentido === 'E') {
      downloadPromise.then(async () => {
        console.log('ENTRADA AUTOMÁTICA!!!!!');
        // faz a entrada automática do veículo
        const newTrafego = {
          nome: '',
          placa: newLogIdentificacao.placa,
          dataEntrada: newLogIdentificacao.data,
          dataSaida: null,
          destino: 'cruzar',
          morador_destino_id: null,
          observacao: '',
          client_id: camera.client_id,
          imagem: null,
          portaria_entrada_id: camera.portaria_id,
          portaria_saida_id: null,
          logIdentificacaoId: ret.id,
          in_whitelist: newLogIdentificacao.whiteList_id > 0,
          whitelist_id: newLogIdentificacao.whiteList_id,
          in_backlist: newLogIdentificacao.blackList_id > 0,
          blacklist_id: newLogIdentificacao.blackList_id,
        };
        await trafegoController.insertTrafego(loggedUserId, newTrafego);
      }).catch((e)=>{
	 console.log("Erro obtendo foto", e);
      });
    }

    // retorna o registro inserido
    return ret;
  }
  /**
   * Insert a logIdentificacao
   */
  async downloadFotosLogIdentificacao(loggedUserId, id) {
    const logIdentificacao = await logIdentificacaoService.get(id);
    console.log('===============================================');
    console.log('downloadFotosLogIdentificacao => logIdentificacao ID:', id);

    // obtendo dados da camera
    const camera = await cameraService.get(loggedUserId, logIdentificacao.camera_id);
    console.log('modelo camera:', camera.modelo);

    // folder ftp
    const date = logIdentificacao.data;
    const ano = _.padStart(date.getFullYear().toString(), 4, '0');
    const mes = _.padStart(parseInt(date.getMonth().toString()) + 1, 2, '0');
    const dia = _.padStart(date.getDate().toString(), 2, '0');
    const hora = _.padStart(date.getHours().toString(), 2, '0');
    const minutos = _.padStart(date.getMinutes().toString(), 2, '0');
    const folder = `fotos/${ano}_${mes}_${dia}-${ano}_${mes}_${dia}`;
    console.log('folder: ', folder);
    console.log('placa: ', logIdentificacao.placa);
    console.log('data: ', logIdentificacao.data);

    const placa = logIdentificacao.placa;

    // obter imagem da placa da camera
    console.log('\n==== obtendo imagem placa ======');
    let imagemPlaca = null;
    if (camera.modelo === 'hikvision-DS-2CD7A26G0/P-IZS') {
      imagemPlaca = await hikvisionService.obterFotoPlaca(camera.url, logIdentificacao.picname);
    } else if (camera.modelo === 'hikvision-iDS-2CD7A26G0/P-IZHS') {
      // obter imagem da placa no ftp
      let files = await ftpService.listarArquivos(folder, `*${placa}_PLATE.*`);
      console.log('Qtde arquivos para a placa: ', files.length);

      let nomeArquivoFoto = '';
      if (files.length == 1) {
        nomeArquivoFoto = files[0];
      } else if (files.length > 1) {
        console.log('filtrando pelo horário');
        files = files.filter((file) => {
          return file.name.indexOf(`${ano}${mes}${dia}${hora}${minutos}`) >= 0;
        });
        if (files.length == 1) {
          nomeArquivoFoto = files[0];
        }
      }
      console.log('Nome arquivo foto: ', nomeArquivoFoto);

      imagemPlaca = await ftpService.lerArquivo(folder, nomeArquivoFoto.name);
    }

    console.log('\n==== obtendo imagem carro ======');
    // obter imagem do carro no ftp

    // obtendo a imagem do carro do FTP
    // localizando primeiro pela placa identificada
    // caso ache mais de uma, filtra pela data
    let padraoBusca = '';
    if (camera.modelo === 'hikvision-DS-2CD7A26G0/P-IZS') {
      padraoBusca = `*${placa}.*`;
    } else if (camera.modelo === 'hikvision-iDS-2CD7A26G0/P-IZHS') {
      padraoBusca = `*${placa}_BACKGROUND.*`;
    }
    let files = await ftpService.listarArquivos(folder, padraoBusca);
    console.log('Qtde arquivos: ', files.length);

    let nomeArquivoFoto = '';
    if (files.length == 1) {
      nomeArquivoFoto = files[0];
    } else if (files.length > 1) {
      console.log('filtrando pelo horário');
      files = files.filter((file) => {
        return file.name.indexOf(`${ano}${mes}${dia}${hora}${minutos}`) >= 0;
      });
      if (files.length == 1) {
        nomeArquivoFoto = files[0];
      }
    } else if (files.length === 0) {
      return { status: 'ERROR', message: `Não encontrada imagem do carro de placa ${logIdentificacao.placa}` };
    }
    console.log('Nome arquivo foto: ', nomeArquivoFoto);

    const imagemCarro = await ftpService.lerArquivo(folder, nomeArquivoFoto.name);

    console.log(`\n==== salvando no banco de dados ====== logIdentificacao ID: ${id}`);
    await logIdentificacaoService.updateImages(loggedUserId, logIdentificacao.id, imagemPlaca, imagemCarro);

    // tenta registrar as saídas
    // if (
    //   (camera.posicionamento === 'F' && logIdentificacao.sentido === 'forward') ||
    //   (camera.posicionamento === 'T' && logIdentificacao.sentido === 'reverse') ||
    //   (camera.sentido === 'S' && logIdentificacao.sentido === 'unknown')
    // ) {
    console.log('CAMERA SENTIDO: ', camera.sentido);
    if (camera.sentido === 'S') {
      console.log('REGISTRANSO SAÍDA');
      this.tentarRegistrarSaidaAutomatica(loggedUserId, id);
    }

    return { status: 'OK' };
  }

  /**
   * Remove a portaria
   */
  async removeLogIdentificacao(loggedUserId, id) {
    const logIdentificacao = await logIdentificacaoService.get(id);
    if (logIdentificacao) {
      const camera = await Camera.findByPk(logIdentificacao.camera_id);
      const saidaNaoIdentificadaDb = await saidaNaoIdentificadaService.getByIdentificadorPlaca(
        logIdentificacao.identificador_placa
      );
      // somente placas descartadas em câmeras de saída vão para a fila de conciliação
      if (!saidaNaoIdentificadaDb && camera && camera.sentido === 'S') {
        const now = new Date();
        const folder = `/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
        const filename = `${logIdentificacao.placa}-saida-nao-ident-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
        const imagens = await salvarImagensLogIdentificacao(logIdentificacao, folder, filename);

        const saidaNaoIdentificada = {
          placa: logIdentificacao.placa,
          identificador_placa: logIdentificacao.identificador_placa,
          data: logIdentificacao.data,
          camera_id: logIdentificacao.camera_id,
          client_id: camera.client_id,
          status: 'pendente',
          imagem_carro: imagens.imagem,
          imagem_carro_thumb: imagens.imagem_thumb,
          imagem_placa: imagens.imagem_placa,
        };
        await saidaNaoIdentificadaService.insert(saidaNaoIdentificada);
      }
    }

    return await logIdentificacaoService.remove(loggedUserId, id);
  }

  async getImagemCarro(id) {
    return await logIdentificacaoService.getImagemCarro(id);
  }

  async tentarRegistrarSaidaAutomatica(loggedUserId, id) {
    const logIdentificacao = await logIdentificacaoService.get(id);
    const trafegoEntrada = await trafegoService.obterRegistroEntradaSemSaida(loggedUserId, logIdentificacao.placa);
    if (trafegoEntrada) {
      const now = new Date();
      const folder = `/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
      const filename = `${trafegoEntrada.placa}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
      const imagens = await salvarImagensLogIdentificacao(logIdentificacao, folder, filename);

      // registra a saída no trafego
      const camera = await cameraService.get(loggedUserId, logIdentificacao.camera_id);
      trafegoService.aplicarSaidaNoTrafego(trafegoEntrada, {
        dataSaida: new Date(),
        placa: logIdentificacao.placa,
        identificador_placa: logIdentificacao.identificador_placa,
        portaria_id: camera.portaria_id,
        user_id: loggedUserId,
        automatica: true,
        ...imagens,
      });
      const ret = await trafegoService.updateTrafegoDB(loggedUserId, trafegoEntrada);

      // removendo o logIdentificacao de saída
      logIdentificacaoService.remove(loggedUserId, id);
      console.log('Encontrou entrada - registrou saida - ', logIdentificacao.placa);
      return { status: 'OK', trafego: ret };
    } else {
      console.log('Não encontrou nenhuma entrada', logIdentificacao.placa);
      return { status: 'OK', trafego: null, message: 'Não encontrou nenhuma entrada' };
    }
  }
}

module.exports = new LogIdentificacaoController();
