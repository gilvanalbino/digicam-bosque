import { reactive, readonly } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import {
  listarSaidasNaoIdentificadas,
  arquivarSaidaNaoIdentificada,
  associarSaidaNaoIdentificada,
} from '../database/dbSaidasNaoIdentificadas';

import useLogin from './useLogin';
import useClientes from './useClientes';
import useTrafegos from './useTrafegos';

const initialState = {
  saidas: {
    lista: [],
    total: 0,
  },
};

const _state = reactive(cloneDeep(initialState));

const state = readonly(_state);

// polling somente enquanto a aba de conciliação estiver aberta
let ativo = false;

const clientId = () => useClientes.state.clientes.selecionado && useClientes.state.clientes.selecionado.id;

const verificarRetorno = (ret) => {
  if (ret && ret.status === 'ERROR') {
    throw new Error(ret.message);
  }
  // erros não tratados chegam com status 200 e o corpo do Boom (ver onPreResponse do backend)
  if (ret && ret.statusCode >= 400) {
    throw new Error('Erro ao processar a solicitação');
  }
  return ret;
};

const actions = {
  async carregarSaidas(client_id = clientId()) {
    if (!client_id) return;
    const ret = await listarSaidasNaoIdentificadas(useLogin.state.auth.token, client_id, {
      status: 'pendente',
      page: 1,
      pageSize: 200,
    });
    verificarRetorno(ret);
    _state.saidas.lista = ret.rows;
    _state.saidas.total = ret.total;
  },

  async arquivar(id, motivo) {
    try {
      verificarRetorno(await arquivarSaidaNaoIdentificada(useLogin.state.auth.token, id, motivo));
    } finally {
      // resolvida aqui ou por outro operador: sai da fila de qualquer forma
      await actions.carregarSaidas();
    }
  },

  async associar(id, trafegoId) {
    try {
      verificarRetorno(await associarSaidaNaoIdentificada(useLogin.state.auth.token, id, trafegoId));
      useTrafegos.actions.removerDasListasSemSaida(trafegoId);
    } finally {
      await actions.carregarSaidas();
      await useTrafegos.actions.carregarSemSaida();
    }
  },

  ativar() {
    ativo = true;
    return actions.carregarSaidas();
  },

  desativar() {
    ativo = false;
  },
};

setInterval(async () => {
  if (ativo && clientId()) {
    try {
      await actions.carregarSaidas();
    } catch (error) {
      console.log('Erro recarregando saídas não identificadas', error);
    }
  }
}, 5000);

export default { state: state, actions };
