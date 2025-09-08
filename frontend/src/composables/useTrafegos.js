// exemplo em https://github.com/vedovelli/screencast-composition-api-state-management/blob/master/src/store/index.js

import { reactive, readonly, toRaw } from 'vue';
import { cloneDeep, padStart, toInteger } from 'lodash';
import { listarTrafegos, removerTrafego, registrarSaidaManual, listarTrafegosComSaida } from '../database/dbTrafegos';

import useLogin from './useLogin';
import useClientes from './useClientes';

const initialState = {
  trafegos: {
    lista: [],
    listaComSaida: [],
  },
};

const _state = reactive(cloneDeep(initialState));

const state = readonly(_state);

const actions = {
  carregarTrafegos(client_id) {
    // console.log('Carregando trafegos...');
    return new Promise(async (resolve, reject) => {
      try {
        const token = useLogin.state.auth.token;

        // obtem os trafegos
        const trafegos = await listarTrafegos(token, client_id);
        _state.trafegos.lista = trafegos;
        calcPermanencia();
        resolve();

        // obtem os trafegos com saida
        // const trafegosComSaida = await listarTrafegosComSaida(token, client_id);
        // _state.trafegos.listaComSaida = trafegosComSaida;
      } catch (error) {
        reject(error);
      }
    });
  },

  removerTrafego(id) {
    return new Promise(async (resolve, reject) => {
      try {
        await removerTrafego(useLogin.state.auth.token, id);
        _state.trafegos.lista = _state.trafegos.lista.filter((c) => c.id !== id);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  registrarSaidaManual(id, portariaId) {
    return new Promise(async (resolve, reject) => {
      try {
        await registrarSaidaManual(useLogin.state.auth.token, id, portariaId);
        _state.trafegos.lista = _state.trafegos.lista.filter((c) => c.id !== id);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  limparTrafegoSessao() {
    _state.trafegos.lista = [];
    useClientes.actions.selecionarCliente(null);
  },
};

const calcDiffDate = (data) => {
  let ret = '';
  const now = new Date().getTime();
  const trafego = new Date(data).getTime();
  let sec = toInteger((now - trafego) / 1000);
  let min = 0;
  let hour = 0;
  ret = `00:00:${padStart('' + sec, 2, '0')}`;
  if (sec > 60) {
    min = toInteger(Math.floor(sec / 60));
    sec = toInteger(sec - min * 60);
    ret = `00:${padStart('' + min, 2, '0')}:${padStart('' + sec, 2, '0')}`;
  }
  if (min > 60) {
    hour = Math.floor(min / 60);
    min = min - hour * 60;
    ret = `${padStart('' + hour, 2, '0')}:${padStart('' + min, 2, '0')}:${padStart('' + sec, 2, '0')}`;
  }

  return ret;
};

// timer para calculo da permanencia do veículo
const calcPermanencia = () => {
  let alarmou = false;
  for (const trafego of _state.trafegos.lista) {
    const diff = calcDiffDate(trafego.dataEntrada);
    trafego.permanencia = diff;
    if (trafego.permanencia > '00:03:00' && trafego.destino === 'cruzar' && !trafego.in_whitelist) {
      alarmou = true;
    }
  }
  if (alarmou) {
    playAlarme();
  }
};
setInterval(calcPermanencia, 1000);

// timer para recarregar os trafegos
const recarregarTrafegos = async () => {
  if (useClientes.state.clientes.selecionado) {
    await actions.carregarTrafegos(useClientes.state.clientes.selecionado.id);
  }
};
setInterval(recarregarTrafegos, 5000);

// audio
var audio = new Audio('alarme.wav');
let playing = false;
audio.onended = function () {
  playing = false;
};
const playAlarme = () => {
  if (useClientes.state.clientes.selecionado.tocar_alarme) {
    if (!playing) {
      console.log('Tocando alarme!');
      audio.play();
    }
  }
};

useLogin.actions.setLimparTrafegoSessao(actions.limparTrafegoSessao);

export default { state: state, actions };
