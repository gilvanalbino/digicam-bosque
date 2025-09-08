// exemplo em https://github.com/vedovelli/screencast-composition-api-state-management/blob/master/src/store/index.js

import { reactive, readonly, toRefs } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { listarClientes, removerCliente } from '../database/dbClientes';

import useLogin from './useLogin';
import usePortarias from './usePortarias';

const initialState = {
  clientes: {
    lista: [],
    selecionado: null,
  },
};

const _state = reactive(cloneDeep(initialState));

const state = readonly(_state);

const actions = {
  carregarClientes() {
    console.log('Carregando clientes...');
    return new Promise(async (resolve, reject) => {
      try {
        const clienteIdAtualSelecionado = _state.clientes.selecionado ? _state.clientes.selecionado.id : null;
        const token = useLogin.state.auth.token;
        const clientes = await listarClientes(token);
        _state.clientes.lista = clientes;

        // seleciona o cliente
        const clientesAtivos = _state.clientes.lista.filter((c) => c.active);
        if (clientesAtivos.length > 0) {
          await this.selecionarCliente(clienteIdAtualSelecionado || clientesAtivos[0].id);
        } else {
          usePortarias.actions.descarregarPortarias();
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  selecionarCliente(id) {
    console.log('Selecionando cliente...');
    if (id) {
      const novoClienteSelecionado = _state.clientes.lista.filter((p) => p.id === id)[0];
      _state.clientes.selecionado = novoClienteSelecionado;

      // atualiza as portarias
      usePortarias.actions.carregarPortarias(_state.clientes.selecionado.id);
    } else {
      _state.clientes.selecionado = null;
    }
  },

  removerCliente(id) {
    return new Promise(async (resolve, reject) => {
      try {
        await removerCliente(useLogin.state.auth.token, id);
        _state.clientes.lista = _state.clientes.lista.filter((c) => c.id !== id);
        if (_state.clientes.selecionado.id === id && _state.clientes.lista.length > 0) {
          this.selecionarCliente(_state.clientes.lista[0].id);
        } else {
          _state.clientes.selecionado = null;
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },
};

export default { state: state, actions };
