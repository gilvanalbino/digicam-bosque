// exemplo em https://github.com/vedovelli/screencast-composition-api-state-management/blob/master/src/store/index.js

import { reactive, readonly } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { api } from '../utils/axios';

// a sessão fica no sessionStorage: sobrevive ao recarregar a página e termina ao fechar a aba
const CHAVE_SESSAO = 'digicam.sessao';

const lerSessao = () => {
  try {
    const sessao = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO));
    return sessao && sessao.token && sessao.user ? sessao : null;
  } catch (error) {
    return null;
  }
};

const gravarSessao = (sessao) => {
  try {
    if (sessao) {
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
    } else {
      sessionStorage.removeItem(CHAVE_SESSAO);
    }
  } catch (error) {
    console.log('Não foi possível gravar a sessão', error);
  }
};

const sessaoSalva = lerSessao();

const initialState = {
  auth: {
    logged: !!sessaoSalva,
    token: sessaoSalva ? sessaoSalva.token : null,
    user: sessaoSalva ? sessaoSalva.user : null,
    // sessão recuperada após recarregar a página: os dados iniciais ainda precisam ser carregados
    restaurada: !!sessaoSalva,
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
          _state.auth.restaurada = false;
          gravarSessao({ token, user: _state.auth.user });
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

  confirmarRestauracao() {
    _state.auth.restaurada = false;
  },

  logout() {
    _state.auth.logged = false;
    _state.auth.user = null;
    _state.auth.token = null;
    _state.auth.restaurada = false;
    gravarSessao(null);

    limparTrafegoSessao();
  },
};

export default { state, actions };
