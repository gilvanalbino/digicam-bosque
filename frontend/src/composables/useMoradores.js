// exemplo em https://github.com/vedovelli/screencast-composition-api-state-management/blob/master/src/store/index.js

import { reactive, readonly, toRaw } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { listarMoradores, removerMorador } from '../database/dbMoradores';

import useLogin from './useLogin';

const initialState = {
  moradores: {
    lista: [],
    map: {},
  },
};

const _state = reactive(cloneDeep(initialState));

const state = readonly(_state);

const actions = {
  carregarMoradores(client_id) {
    console.log('Carregando moradores...');
    return new Promise(async (resolve, reject) => {
      try {
        const token = useLogin.state.auth.token;

        // obtem as moradores
        const moradores = await listarMoradores(token, client_id);
        _state.moradores.lista = moradores;
        _state.moradores.map = {};
        moradores.forEach((morador) => {
          _state.moradores.map[morador.id] = morador;
        });

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  removerMorador(id) {
    return new Promise(async (resolve, reject) => {
      try {
        await removerMorador(useLogin.state.auth.token, id);
        _state.moradores.lista = _state.moradores.lista.filter((c) => c.id !== id);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },
};

export default { state: state, actions };
