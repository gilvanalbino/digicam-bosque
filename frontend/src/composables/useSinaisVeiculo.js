// Sinais mostrados nos cards de veículo: o último alerta de anomalia não descartado da placa e a data da
// primeira passagem dela no condomínio. Os cards registram a placa que exibem (componente SinaisVeiculo) e as
// consultas saem em lote; os alertas são reconsultados a cada minuto, porque nascem depois da passagem.

import { reactive, readonly } from 'vue';

import useLogin from './useLogin';
import useClientes from './useClientes';
import { obterSinaisDasPlacas } from '../database/dbAnomalias';

const INTERVALO_MS = 60000;
const ESPERA_LOTE_MS = 300;
const LOTE = 1000;

const _state = reactive({
  // placa -> { anomalia: { id, score, faixa, status, ocorrido_em } | null, primeira_passagem: ISO | null | undefined }
  sinais: {},
  // pedido de abertura do relatório de um alerta (DetalheAnomalia observa)
  pedido: null,
  // contador de revisões registradas: as telas que listam alertas recarregam quando ele muda
  revisoes: 0,
});

const normalizar = (placa) => (placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// placas em exibição (placa -> quantos cards) e as que ainda não foram consultadas
const emExibicao = new Map();
const novas = new Set();
let clienteDosSinais = null;
let esperaLote = null;
let intervalo = null;

const clienteId = () => (useClientes.state.clientes.selecionado ? useClientes.state.clientes.selecionado.id : null);

const consultar = async (placas) => {
  const cliente = clienteId();
  if (!cliente || placas.length === 0) return;
  for (let i = 0; i < placas.length; i += LOTE) {
    const lote = placas.slice(i, i + LOTE);
    // a primeira passagem não muda depois de conhecida: só é pedida uma vez por placa
    const primeira = lote.filter((placa) => !_state.sinais[placa] || _state.sinais[placa].primeira_passagem === undefined);
    try {
      const ret = await obterSinaisDasPlacas(useLogin.state.auth.token, cliente, lote, primeira);
      if (ret.status !== 'OK' || cliente !== clienteId()) return;
      for (const [placa, sinal] of Object.entries(ret.sinais)) {
        _state.sinais[placa] = { ...(_state.sinais[placa] || {}), ...sinal };
      }
    } catch (error) {
      // os sinais são um complemento do card: sem eles a tela segue funcionando
      console.log('Erro consultando os sinais dos veículos', error);
      return;
    }
  }
};

const conferirCliente = () => {
  if (clienteDosSinais !== clienteId()) {
    clienteDosSinais = clienteId();
    Object.keys(_state.sinais).forEach((placa) => delete _state.sinais[placa]);
    emExibicao.forEach((_, placa) => novas.add(placa));
  }
};

const consultarNovas = () => {
  esperaLote = null;
  conferirCliente();
  const placas = [...novas];
  novas.clear();
  consultar(placas);
};

const reconsultar = () => {
  conferirCliente();
  novas.clear();
  consultar([...emExibicao.keys()]);
};

/** Um card passou a exibir a placa. */
const registrar = (placa) => {
  const chave = normalizar(placa);
  if (!chave) return;
  emExibicao.set(chave, (emExibicao.get(chave) || 0) + 1);
  conferirCliente();
  if (!_state.sinais[chave]) {
    novas.add(chave);
    if (!esperaLote) esperaLote = setTimeout(consultarNovas, ESPERA_LOTE_MS);
  }
  if (!intervalo) intervalo = setInterval(reconsultar, INTERVALO_MS);
};

/** O card deixou de exibir a placa. */
const liberar = (placa) => {
  const chave = normalizar(placa);
  const restantes = (emExibicao.get(chave) || 0) - 1;
  if (restantes > 0) {
    emExibicao.set(chave, restantes);
  } else {
    emExibicao.delete(chave);
  }
  if (emExibicao.size === 0 && intervalo) {
    clearInterval(intervalo);
    intervalo = null;
  }
};

const sinalDaPlaca = (placa) => _state.sinais[normalizar(placa)] || null;

const abrirAnomalia = (id) => {
  _state.pedido = { id };
};

/** Depois de uma revisão o alerta pode ter sido descartado: os ícones dos cards são atualizados. */
const anomaliaRevisada = () => {
  _state.revisoes++;
  reconsultar();
};

export default {
  state: readonly(_state),
  registrar,
  liberar,
  sinalDaPlaca,
  abrirAnomalia,
  anomaliaRevisada,
};
