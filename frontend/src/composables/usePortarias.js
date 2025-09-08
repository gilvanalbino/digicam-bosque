// exemplo em https://github.com/vedovelli/screencast-composition-api-state-management/blob/master/src/store/index.js

import { reactive, readonly, toRaw } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { listarPortarias, removerPortaria } from '../database/dbPortarias';

import useLogin from './useLogin';
import useTrafegos from './useTrafegos';

const initialState = {
  portarias: {
    lista: [],
    selecionada: null,
    map: {},
  },
};

const _state = reactive(cloneDeep(initialState));

const state = readonly(_state);

const actions = {
  carregarPortarias(client_id) {
    console.log('Carregando portarias...');
    return new Promise(async (resolve, reject) => {
      try {
        const token = useLogin.state.auth.token;

        // obtem as portarias
        const portarias = await listarPortarias(token, client_id);
        _state.portarias.lista = portarias;

        // mantem o id da portaria selecionada se ele existir na nova lista
        if (portarias.length > 0) {
          let portariaIdAtualSelecionada = null;
          if (
            _state.portarias.selecionada &&
            _state.portarias.lista.find((p) => p.id === _state.portarias.selecionada.id)
          ) {
            portariaIdAtualSelecionada = _state.portarias.selecionada.id;
          }
          this.selecionarPortaria(portariaIdAtualSelecionada || portarias[0].id);
        } else {
          _state.portarias.selecionada = null;
        }

        _state.portarias.map = {};
        portarias.forEach((portaria) => {
          _state.portarias.map[portaria.id] = portaria;
        });

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  async selecionarPortaria(id) {
    console.log('Selecionando portarias... id=', toRaw(id));
    const novaPortariaSelecionada = _state.portarias.lista.filter((p) => p.id === id)[0];
    _state.portarias.selecionada = novaPortariaSelecionada;
  },

  descarregarPortarias() {
    console.log('Descarregando portarias...');
    _state.lista = [];
    _state.selecionada = null;
  },

  removerPortaria(id) {
    return new Promise(async (resolve, reject) => {
      try {
        await removerPortaria(useLogin.state.auth.token, id);
        _state.portarias.lista = _state.portarias.lista.filter((c) => c.id !== id);
        if (_state.portarias.selecionada.id === id && _state.portarias.lista.length > 0) {
          this.selecionarPortaria(_state.portarias.lista[0].id);
        } else {
          _state.portarias.selecionada = null;
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },
};

export default { state: state, actions };
