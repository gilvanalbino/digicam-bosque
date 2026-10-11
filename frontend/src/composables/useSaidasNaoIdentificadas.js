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
  // interação entre o painel de saídas e os cards de entrada (seleção, arraste e pedido de associação)
  interacao: {
    selecionada: null,
    arrastando: null,
    // entrada arrastada de uma das listas até um card de saída (associação no sentido inverso)
    entradaArrastada: null,
    pedido: null,
  },
};

const _state = reactive(cloneDeep(initialState));

const state = readonly(_state);

// polling somente enquanto o painel de saídas estiver na tela
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
    // a saída selecionada pode ter sido resolvida por outro operador
    const selecionada = _state.interacao.selecionada;
    if (selecionada) {
      _state.interacao.selecionada = ret.rows.find((s) => s.id === selecionada.id) || null;
    }
  },

  selecionar(saida) {
    const selecionada = _state.interacao.selecionada;
    _state.interacao.selecionada = selecionada && selecionada.id === saida.id ? null : saida;
  },

  limparSelecao() {
    _state.interacao.selecionada = null;
  },

  iniciarArraste(saida) {
    _state.interacao.arrastando = saida;
  },

  finalizarArraste() {
    _state.interacao.arrastando = null;
  },

  iniciarArrasteEntrada(entrada) {
    _state.interacao.entradaArrastada = entrada;
  },

  finalizarArrasteEntrada() {
    _state.interacao.entradaArrastada = null;
  },

  // pede a confirmação da associação da saída com a entrada (o painel de saídas abre o diálogo)
  pedirAssociacao(entrada, saida) {
    _state.interacao.pedido = { entrada, saida };
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
      useTrafegos.actions.carregarTrafegos(clientId()).catch(() => {});
    }
  },

  ativar() {
    ativo = true;
    return actions.carregarSaidas();
  },

  desativar() {
    ativo = false;
    Object.assign(_state.interacao, cloneDeep(initialState.interacao));
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

// uma saída só pode ser associada a uma entrada que aconteceu antes dela
export const podeAssociar = (entrada, saida) =>
  !!entrada && !!saida && new Date(saida.data) >= new Date(entrada.dataEntrada);

export default { state: state, actions };
