// exemplo em https://github.com/vedovelli/screencast-composition-api-state-management/blob/master/src/store/index.js

import { reactive, readonly, toRaw } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { listarCameras, removerCamera } from '../database/dbCameras';

import useLogin from './useLogin';

const initialState = {
  cameras: {
    lista: [],
    map: {},
  },
};

const _state = reactive(cloneDeep(initialState));

const state = readonly(_state);

const actions = {
  carregarCameras(client_id) {
    console.log('Carregando cameras...');
    return new Promise(async (resolve, reject) => {
      try {
        const token = useLogin.state.auth.token;

        // obtem as cameras
        const cameras = await listarCameras(token, client_id);
        _state.cameras.lista = cameras;

        _state.cameras.map = {};
        cameras.forEach((camera) => {
          _state.cameras.map[camera.id] = camera;
        });

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  removerCamera(id) {
    return new Promise(async (resolve, reject) => {
      try {
        await removerCamera(useLogin.state.auth.token, id);
        _state.cameras.lista = _state.cameras.lista.filter((c) => c.id !== id);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  getCameraEntrada(portariaId) {
    const cameras = _state.cameras.lista.filter((c) => {
      return (c.sentido === 'E' || c.sentido === 'ES') && c.portaria_id == portariaId;
    });
    if (cameras.length > 0) {
      return cameras[0];
    } else {
      return null;
    }
  },
};

export default { state: state, actions };
