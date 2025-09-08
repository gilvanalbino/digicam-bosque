// exemplo em https://github.com/vedovelli/screencast-composition-api-state-management/blob/master/src/store/index.js

import { reactive, readonly } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { api } from '../utils/axios';

const initialState = {
  auth: {
    logged: false,
    token: null,
    user: null,
  },
};

const _state = reactive(cloneDeep(initialState));

const state = readonly(_state);

let limparTrafegoSessao;

const actions = {
  login(user) {
    return new Promise((resolve, reject) => {
      api
        .post('/login', { email: user.email, password: user.password })
        .then((response) => {
          const { email, name, token, admin, admin_client } = response.data;
          _state.auth.logged = true;
          _state.auth.token = token;
          _state.auth.user = { email, name, admin, admin_client };
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  },

  setLimparTrafegoSessao(l) {
    limparTrafegoSessao = l;
  },

  logout() {
    _state.logged = false;
    _state.user = null;
    _state.token = null;

    limparTrafegoSessao();
  },
};

export default { state, actions };
