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

const TAMANHO_MAXIMO_PLACA = 7;

const gerarIdentificadorUnico = (date, placa) => {
  return `${date.getTime()}-${placa}`;
};

// placa como a câmera leu, guardada no identificador (a placa do registro pode ter sido corrigida pela green list)
const placaLidaPelaCamera = (logIdentificacao) => {
  const identificador = logIdentificacao.identificador_placa || '';
  const separador = identificador.indexOf('-');
  return separador > 0 ? identificador.slice(separador + 1) : logIdentificacao.placa;
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

// distância máxima entre o horário da leitura e o do arquivo para a foto ser considerada da mesma passagem;
// a foto da própria câmera chega com até 2 s de diferença
const TOLERANCIA_FOTO_MS = 10 * 1000;

// o nome do arquivo começa com o horário da captura (AAAAMMDDHHMMSS), na hora local da câmera
const horarioArquivoFoto = (nome) => {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(nome);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
};

/**
 * Escolhe, entre os arquivos da placa localizados no FTP, o de horário mais próximo da leitura.
 * Arquivos fora da tolerância são de outra passagem do veículo (por exemplo, a foto da entrada quando a
 * leitura é da saída) e não são usados. Retorna null quando nenhum arquivo serve.
 */
const selecionarArquivoFoto = (files, dataLeitura) => {
  let escolhido = null;
  let menorDistancia = Infinity;
  for (const file of files) {
    const horario = horarioArquivoFoto(file.name);
    if (!horario) continue;
    const distancia = Math.abs(horario.getTime() - dataLeitura.getTime());
    if (distancia <= TOLERANCIA_FOTO_MS && distancia < menorDistancia) {
      escolhido = file;
      menorDistancia = distancia;
    }
  }
  return escolhido;
};

// Movimento do veículo em relação ao condomínio (E = entrando, S = saindo) a partir da direção informada pela
// câmera e do posicionamento dela no cadastro: (F) direcionada para fora, (T) direcionada para dentro.
const MOVIMENTO_POR_POSICIONAMENTO = {
  F: { forward: 'S', reverse: 'E' },
  T: { forward: 'E', reverse: 'S' },
};

/**
 * Indica se a leitura foi feita com o veículo no sentido contrário ao propósito da câmera (por exemplo, um
 * veículo entrando lido pela câmera de saída). Direção "unknown" e câmera sem posicionamento não são filtradas.
 */
const leituraNoSentidoContrario = (camera, direcao) => {
  const movimento = (MOVIMENTO_POR_POSICIONAMENTO[camera.posicionamento] || {})[direcao];
  return !!movimento && movimento !== camera.sentido;
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
    // placa tem no máximo 7 caracteres; leitura maior é adesivo ou texto do veículo lido como placa
    if ((newLogIdentificacao.placa || '').length > TAMANHO_MAXIMO_PLACA) {
      console.log(`Placa ${newLogIdentificacao.placa} ignorada: mais de ${TAMANHO_MAXIMO_PLACA} caracteres`);
      return { mensagem: 'Leitura ignorada: placa com mais de 7 caracteres' };
    }

    const placaId = gerarIdentificadorUnico(newLogIdentificacao.data, newLogIdentificacao.placa);

    const camera = await cameraService.get(loggedUserId, newLogIdentificacao.camera_id);

    // câmera de saída só registra saídas e câmera de entrada só registra entradas
    if (leituraNoSentidoContrario(camera, newLogIdentificacao.sentido)) {
      console.log(
        `Placa ${newLogIdentificacao.placa} ignorada: direção ${newLogIdentificacao.sentido} contrária ao sentido da câmera ${camera.nome}`
      );
      return { mensagem: 'Leitura ignorada: sentido contrário ao da câmera' };
    }

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

    // leitura com 1 caractere de diferença de uma placa da green list é erro da câmera: assume a placa da lista.
    // Placa lida que está na red list nunca é trocada. O identificador_placa mantém a placa lida, que é a usada
    // para descartar leituras repetidas e localizar as fotos no FTP.
    const placaNaRedList = await blackListService.findByPlaca(loggedUserId, client.id, newLogIdentificacao.placa);
    if (!placaNaRedList) {
      const placaCorrigida = await whiteListService.obterPlacaCorrigida(client.id, newLogIdentificacao.placa);
      if (placaCorrigida) {
        console.log(`Placa ${newLogIdentificacao.placa} corrigida para ${placaCorrigida} (green list)`);
        newLogIdentificacao.placa = placaCorrigida;
      }
    }

    newLogIdentificacao.imagem_pendente = true;
    newLogIdentificacao.imagem_placa = null;
    newLogIdentificacao.imagem_carro = null;
    newLogIdentificacao.identificador_placa = placaId;

    // fazendo inicialmente uma baixa manual, para minimizar problemas de download de imagem
    if (camera.sentido === 'S') {
      const trafegoEntrada = await trafegoService.obterRegistroEntradaSemSaida(
        loggedUserId,
        newLogIdentificacao.placa,
        newLogIdentificacao.data
      );
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
      downloadPromise.then(async (retDownload) => {
        if (retDownload.status !== 'OK') {
          console.log('Entrada automática não realizada:', retDownload.message);
          return;
        }
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
    } else {
      // sem tratamento, a rejeição desta promise derruba o processo
      downloadPromise.catch((e) => {
        console.log('Erro obtendo foto', e);
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
    const folder = `fotos/${ano}_${mes}_${dia}-${ano}_${mes}_${dia}`;
    console.log('folder: ', folder);
    console.log('placa: ', logIdentificacao.placa);
    console.log('data: ', logIdentificacao.data);

    // os arquivos no FTP têm no nome a placa lida pela câmera
    const placa = placaLidaPelaCamera(logIdentificacao);

    // obter imagem da placa da camera
    // a foto da placa é opcional: se não for localizada, segue sem ela
    console.log('\n==== obtendo imagem placa ======');
    let imagemPlaca = null;
    try {
      if (camera.modelo === 'hikvision-DS-2CD7A26G0/P-IZS') {
        imagemPlaca = await hikvisionService.obterFotoPlaca(camera.url, logIdentificacao.picname);
      } else if (camera.modelo === 'hikvision-iDS-2CD7A26G0/P-IZHS') {
        // obter imagem da placa no ftp
        const files = await ftpService.listarArquivos(folder, `*${placa}_PLATE.*`);
        console.log('Qtde arquivos para a placa: ', files.length);

        const arquivoFoto = selecionarArquivoFoto(files, date);
        console.log('Nome arquivo foto: ', arquivoFoto && arquivoFoto.name);
        if (arquivoFoto) {
          imagemPlaca = await ftpService.lerArquivo(folder, arquivoFoto.name);
        }
      }
    } catch (e) {
      console.log('Erro obtendo imagem da placa', e);
    }

    console.log('\n==== obtendo imagem carro ======');
    // obtendo a imagem do carro do FTP
    // localizando primeiro pela placa identificada
    // caso ache mais de uma, filtra pela data
    let imagemCarro = null;
    try {
      let padraoBusca = '';
      if (camera.modelo === 'hikvision-DS-2CD7A26G0/P-IZS') {
        padraoBusca = `*${placa}.*`;
      } else if (camera.modelo === 'hikvision-iDS-2CD7A26G0/P-IZHS') {
        padraoBusca = `*${placa}_BACKGROUND.*`;
      }
      const files = await ftpService.listarArquivos(folder, padraoBusca);
      console.log('Qtde arquivos: ', files.length);

      const arquivoFoto = selecionarArquivoFoto(files, date);
      console.log('Nome arquivo foto: ', arquivoFoto && arquivoFoto.name);
      if (arquivoFoto) {
        imagemCarro = await ftpService.lerArquivo(folder, arquivoFoto.name);
      }
    } catch (e) {
      console.log('Erro obtendo imagem do carro', e);
    }

    if (imagemCarro) {
      console.log(`\n==== salvando no banco de dados ====== logIdentificacao ID: ${id}`);
      await logIdentificacaoService.updateImages(loggedUserId, logIdentificacao.id, imagemPlaca, imagemCarro);
    }

    // tenta registrar as saídas
    // if (
    //   (camera.posicionamento === 'F' && logIdentificacao.sentido === 'forward') ||
    //   (camera.posicionamento === 'T' && logIdentificacao.sentido === 'reverse') ||
    //   (camera.sentido === 'S' && logIdentificacao.sentido === 'unknown')
    // ) {
    console.log('CAMERA SENTIDO: ', camera.sentido);
    if (camera.sentido === 'S') {
      console.log('REGISTRANSO SAÍDA');
      // a saída é registrada mesmo sem foto, para o veículo não ficar sem saída
      this.tentarRegistrarSaidaAutomatica(loggedUserId, id).catch((e) => {
        console.log('Erro registrando saída automática', e);
      });
    }

    if (!imagemCarro) {
      return { status: 'ERROR', message: `Não encontrada imagem do carro de placa ${logIdentificacao.placa}` };
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
      // a saída pode já ter sido registrada em uma entrada na chegada da placa (baixa sem imagem);
      // nesse caso ela não é uma saída sem entrada e fica fora da fila
      const saidaJaRegistrada = await databaseService.obterTrafegoSaidaPlaca(logIdentificacao.identificador_placa);
      // somente placas descartadas em câmeras de saída vão para a fila de conciliação
      if (!saidaNaoIdentificadaDb && !saidaJaRegistrada && camera && camera.sentido === 'S') {
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
    const trafegoEntrada = await trafegoService.obterRegistroEntradaSemSaida(
      loggedUserId,
      logIdentificacao.placa,
      logIdentificacao.data,
      logIdentificacao.identificador_placa
    );
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
      logIdentificacaoService.remove(loggedUserId, id).catch((e) => {
        console.log('Erro removendo logIdentificacao de saída', e);
      });
      console.log('Encontrou entrada - registrou saida - ', logIdentificacao.placa);
      return { status: 'OK', trafego: ret };
    }

    // sem entrada de placa igual: associa à entrada em travessia de placa mais próxima (erro de leitura da
    // câmera). A associação fica marcada como automática e o operador pode desfazê-la na tela de tráfego.
    const camera = await cameraService.get(loggedUserId, logIdentificacao.camera_id);
    const entradaProxima = await saidaNaoIdentificadaService.obterEntradaPorPlacaProxima(
      camera.client_id,
      logIdentificacao.placa,
      logIdentificacao.data
    );
    if (entradaProxima) {
      const now = new Date();
      const folder = `/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
      const filename = `${logIdentificacao.placa}-saida-aprox-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
      const imagens = await salvarImagensLogIdentificacao(logIdentificacao, folder, filename);
      const trafego = await saidaNaoIdentificadaService.associarAutomaticamente(
        loggedUserId,
        {
          placa: logIdentificacao.placa,
          identificador_placa: logIdentificacao.identificador_placa,
          data: logIdentificacao.data,
          camera_id: logIdentificacao.camera_id,
          client_id: camera.client_id,
          imagem_carro: imagens.imagem,
          imagem_carro_thumb: imagens.imagem_thumb,
          imagem_placa: imagens.imagem_placa,
        },
        entradaProxima.id,
        camera.portaria_id
      );
      if (trafego) {
        logIdentificacaoService.remove(loggedUserId, id).catch((e) => {
          console.log('Erro removendo logIdentificacao de saída', e);
        });
        console.log(`Saída ${logIdentificacao.placa} associada à entrada de placa próxima ${entradaProxima.placa}`);
        return { status: 'OK', trafego };
      }
    }

    console.log('Não encontrou nenhuma entrada', logIdentificacao.placa);
    return { status: 'OK', trafego: null, message: 'Não encontrou nenhuma entrada' };
  }
}

module.exports = new LogIdentificacaoController();
