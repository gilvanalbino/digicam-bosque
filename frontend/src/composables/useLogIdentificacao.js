// exemplo em https://github.com/vedovelli/screencast-composition-api-state-management/blob/master/src/store/index.js

import { reactive, readonly, toRaw } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { listarIdentificacoes, removerIdentificacao } from '../database/dbLogIdentificacao';

import useTrafegos from './useTrafegos';

import useLogin from './useLogin';

const initialState = {
  identificacoes: {
    lista: [],
    portaria_id: null,
  },
};

const _state = reactive(cloneDeep(initialState));

const state = readonly(_state);

const actions = {
  carregarIdentificacoes(portaria_id) {
    return new Promise(async (resolve, reject) => {
      try {
        const token = useLogin.state.auth.token;

        // obtem as identificacoes
        const identificacoes = await listarIdentificacoes(token, portaria_id);

        const identificacoesEnriquecida = identificacoes.map((logIdent) => {
          const direction = logIdent.sentido;
          const sentidoCamera = logIdent.Camera.sentido;
          const posicionamento = logIdent.Camera.posicionamento;
          // if (
          //   (posicionamento === 'F' && direction === 'reverse') ||
          //   (posicionamento === 'T' && direction === 'forward') ||
          //   (sentidoCamera === 'E' && direction === 'unknown')
          // ) {
          if (sentidoCamera === 'E') {
            return { ...logIdent, action: 'Entrando...' };
            // } else if (
            //   (posicionamento === 'F' && direction === 'forward') ||
            //   (posicionamento === 'T' && direction === 'reverse') ||
            //   (sentidoCamera === 'S' && direction === 'unknown')
            // ) {
          } else if (sentidoCamera === 'S') {
            // const trafegoFiltred = useTrafegos.state.trafegos.lista.filter((t) => t.placa === logIdent.placa);
            // if (trafegoFiltred.length > 0) {
            //   const trafego = trafegoFiltred[0];
            //   return { ...logIdent, action: `Saída com entrada (${trafego.permanencia})` };
            // }
            return { ...logIdent, action: 'Saindo...' };
          }
        });

        _state.identificacoes.lista = identificacoesEnriquecida;
        _state.identificacoes.portaria_id = portaria_id;

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  removerIdentificacao(id) {
    return new Promise(async (resolve, reject) => {
      try {
        await removerIdentificacao(useLogin.state.auth.token, id);
        _state.identificacoes.lista = _state.identificacoes.lista.filter((item) => item.id !== id);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  findById(id) {
    console.log('state: ', toRaw(_state.identificacoes.lista));
    const filtred = _state.identificacoes.lista.filter((item) => item.id == id);
    console.log('filtred: ', filtred);
    if (filtred.length > 0) {
      return filtred[0];
    } else {
      return null;
    }
  },
};

const recarregarIdentificacoes = async () => {
  if (_state.identificacoes.portaria_id) {
    await actions.carregarIdentificacoes(_state.identificacoes.portaria_id);
  }
};

setInterval(recarregarIdentificacoes, 5000);

export default { state: state, actions };
