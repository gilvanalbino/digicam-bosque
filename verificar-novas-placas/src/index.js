console.log('===========================');
console.log('VERIFICAR-NOVAS-PLACAS - V2');
console.log('===========================');

const schedule = require('node-schedule');

// Se está rodando em ambiente de desenvolvimento, obtem as configurações do arquivo .env
if (process.env.NODE_ENV == 'dev') {
  require('dotenv').config();
}

const hikVisionService = require('./services/hikVision.service');
const digicamBackend = require('./services/digicam-backend.service');

// criar o job que executará as tarefas
const cronSchedule = process.env.CRON_SCHEDULE;
const clientIds =
  process.env.CLIENT_IDS.indexOf(',') > 0 ? process.env.CLIENT_IDS.split(',') : [process.env.CLIENT_IDS];

console.log('CLIENT_IDS: ', clientIds);

let token = null;
let cameras = [];
// const dataUltimaIdentificacaoPorCamera = {};

const verificarNovasPlacas = async () => {
  console.log("verificando novas placas");
  if (!token) {
    console.log("fazendo login");
    try {
      token = await digicamBackend.login();
      console.log("login com sucesso!!!");
    } catch(e) {
      console.error("Erro no login... ", e);
      throw e;
    }
  }

  // obter info cameras
  if (cameras.length == 0) {
    for (const clientId of clientIds) {
      try {
        console.log("obtendo lista de cameras....");
        const camerasCliente = await digicamBackend.listarCameras(token, clientId);
        console.log("lista de cameras obtidas com sucesso", camerasCliente);
        for (const camera of camerasCliente) {
           cameras.push(camera);
        }
      } catch(e) {
	console.error("Erro obtendo a lista de cameras... ", e);
	throw e;
      }
    }
    console.log(new Date(), ' - Cameras: ', cameras);
  }

  const data3MinAgo = new Date(new Date() - 3 * 60 * 1000);
  // const data15MinAgo = new Date(new Date() - 15 * 60 * 1000);
  const atraso = 3;
  const currentDate = new Date();
  const searchDate = new Date(currentDate.getTime() - atraso * 60000);

  console.log('searchDate:', searchDate);

  for (const camera of cameras) {
    const logIdentList = await digicamBackend.listarPlacasReconhecidas(token, camera.id);

    // remove placas antigas
    const logIdentParaRemover = logIdentList.filter((logIdent) => {
      const dateLog = new Date(logIdent.data);
      return dateLog < data3MinAgo;
    });

    // solicita a remoção
    for (const logIdent of logIdentParaRemover) {
      try {
        console.log(new Date(), ' - Removendo LogIdentificacao antigo: ', logIdent.id);
        await digicamBackend.removerIdentificacao(token, logIdent.id);
      } catch (error) {
        console.log(new Date(), ' - Erro removendo LogIdentificacao antigo: ', logIdent.id, error);
      }
    }
  }

  // obtem placas identificadas e manda para o digicam-backend
  for (const camera of cameras) {
    console.log(new Date(), ` - ${camera.nome}`);
    // obtendo as novas placas identificadas
    const debug = process.env.DEBUG_CURL === 'true';
    const placas = await hikVisionService.obterPlacas(camera, searchDate, debug);
    // console.log('placas antes filtro: ', placas.map((p) => p.plateNumber).join(', '));

    const novasPlacas = placas.filter((p) => searchDate.getTime() - p.captureTime.getTime() < 60 * 1000);
    // console.log('placas apos filtro: ', novasPlacas.map((p) => p.plateNumber).join(', '));

    for (const placa of novasPlacas) {
      const novaPlaca = {
        placa: placa.plateNumber,
        sentido: placa.direction,
        data: placa.captureTime,
        camera_id: camera.id,
        picname: placa.picName,
      };
      console.log('      - Inserindo placa: ', novaPlaca.placa);
      await digicamBackend.inserirNovaPlacaIdentificada(token, novaPlaca);
    }
  }
};

// let isRunning = false;
const job = schedule.scheduleJob(cronSchedule, async function () {
  console.log(new Date(), '==== scheduleJob starting ====');
  try {
    await verificarNovasPlacas();
  } catch (error) {
    console.log(error);
    console.error(error);
  } finally {
    console.log(new Date(), '**** scheduleJob finished! *** \n');
  }
});

console.log("job=", job);
