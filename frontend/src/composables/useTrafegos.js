// exemplo em https://github.com/vedovelli/screencast-composition-api-state-management/blob/master/src/store/index.js

import { reactive, readonly } from 'vue';
import { cloneDeep } from 'lodash';
import { listarTrafegosPorStatus, removerTrafego, registrarSaidaManual } from '../database/dbTrafegos';

import useLogin from './useLogin';
import useClientes from './useClientes';

import { calcularPermanencia } from '../utils/dateUtil';

export const ABAS = ['travessia', 'servico', 'historico', 'conciliacao'];

const PAGE_SIZE = 50;

const initialState = {
  trafegos: {
    // Aba 1 - Em Travessia: sempre atualizada, mesmo com outra aba ativa (alarme de permanência)
    lista: [],
    abaAtiva: 'travessia',
    // Aba 2 - Em Serviço / Visitantes Autorizados
    // total null = ainda não consultado (contador da aba fica oculto)
    servico: {
      rows: [],
      total: null,
      page: 1,
      filtros: { placa: '', entradaDe: '', entradaAte: '' },
    },
    // Aba 3 - Histórico de Saídas do dia
    historico: {
      rows: [],
      total: null,
      page: 1,
      novos: 0,
      filtros: { placa: '' },
      ordem: 'saida_desc',
    },
    // Aba 4 - entradas sem saída (travessia + serviço) para conciliação
    semSaida: [],
  },
};

const _state = reactive(cloneDeep(initialState));

const state = readonly(_state);

// descarta respostas de consultas antigas quando filtros/página mudam durante o polling
const sequencia = { servico: 0, historico: 0, semSaida: 0 };

// converte "HH:mm" (hoje) para ISO, usado nos filtros de horário de entrada
const horarioHojeIso = (horario) => {
  if (!horario) return null;
  const [hora, minuto] = horario.split(':');
  const data = new Date();
  data.setHours(Number(hora), Number(minuto), 0, 0);
  return data.toISOString();
};

const clientId = () => useClientes.state.clientes.selecionado && useClientes.state.clientes.selecionado.id;

const actions = {
  /**
   * Carrega a Aba 1 (Em Travessia) e a aba ativa
   */
  carregarTrafegos(client_id) {
    return new Promise(async (resolve, reject) => {
      try {
        const token = useLogin.state.auth.token;

        const carregarTravessia = async () => {
          const travessia = await listarTrafegosPorStatus(token, client_id, 'travessia');
          _state.trafegos.lista = travessia.rows;
          calcPermanencia();
        };

        const carregarAbaAtiva = async () => {
          if (_state.trafegos.abaAtiva === 'servico') {
            await actions.carregarServico(client_id);
          } else if (_state.trafegos.abaAtiva === 'historico') {
            await actions.carregarHistorico(client_id);
          } else if (_state.trafegos.abaAtiva === 'conciliacao') {
            await actions.carregarSemSaida(client_id);
          }
        };

        // uma consulta com falha não impede a outra de atualizar a tela
        const resultados = await Promise.allSettled([carregarTravessia(), carregarAbaAtiva()]);
        const falha = resultados.find((r) => r.status === 'rejected');
        if (falha) {
          throw falha.reason;
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  async carregarServico(client_id = clientId()) {
    const seq = ++sequencia.servico;
    const { page, filtros } = _state.trafegos.servico;
    const ret = await listarTrafegosPorStatus(useLogin.state.auth.token, client_id, 'servico', {
      placa: filtros.placa,
      entradaDe: horarioHojeIso(filtros.entradaDe),
      entradaAte: horarioHojeIso(filtros.entradaAte),
      page,
      pageSize: PAGE_SIZE,
    });
    if (seq !== sequencia.servico) return;
    _state.trafegos.servico.rows = ret.rows;
    _state.trafegos.servico.total = ret.total;
    calcPermanencia();
  },

  async carregarHistorico(client_id = clientId()) {
    const seq = ++sequencia.historico;
    const historico = _state.trafegos.historico;
    const ret = await listarTrafegosPorStatus(useLogin.state.auth.token, client_id, 'saidas', {
      placa: historico.filtros.placa,
      ordem: historico.ordem,
      page: historico.page,
      pageSize: PAGE_SIZE,
    });
    if (seq !== sequencia.historico) return;
    // fora da primeira página, avisa sobre novas saídas em vez de deslocar a lista do operador
    if (historico.page > 1 && historico.total !== null && ret.total > historico.total) {
      historico.novos += ret.total - historico.total;
    }
    historico.rows = ret.rows;
    historico.total = ret.total;
  },

  async carregarSemSaida(client_id = clientId()) {
    const seq = ++sequencia.semSaida;
    const ret = await listarTrafegosPorStatus(useLogin.state.auth.token, client_id, 'sem_saida', {
      page: 1,
      pageSize: 200,
    });
    if (seq !== sequencia.semSaida) return;
    _state.trafegos.semSaida = ret.rows;
    calcPermanencia();
  },

  selecionarAba(aba) {
    if (!ABAS.includes(aba)) {
      aba = 'travessia';
    }
    _state.trafegos.abaAtiva = aba;
    if (clientId()) {
      return actions.carregarTrafegos(clientId());
    }
  },

  filtrarServico(filtros) {
    _state.trafegos.servico.filtros = { ..._state.trafegos.servico.filtros, ...filtros };
    _state.trafegos.servico.page = 1;
    return actions.carregarServico();
  },

  paginarServico(page) {
    _state.trafegos.servico.page = page;
    return actions.carregarServico();
  },

  filtrarHistorico(filtros) {
    _state.trafegos.historico.filtros = { ..._state.trafegos.historico.filtros, ...filtros };
    _state.trafegos.historico.page = 1;
    _state.trafegos.historico.novos = 0;
    return actions.carregarHistorico();
  },

  ordenarHistorico(ordem) {
    _state.trafegos.historico.ordem = ordem;
    _state.trafegos.historico.page = 1;
    _state.trafegos.historico.novos = 0;
    return actions.carregarHistorico();
  },

  paginarHistorico(page) {
    _state.trafegos.historico.page = page;
    _state.trafegos.historico.novos = 0;
    return actions.carregarHistorico();
  },

  removerTrafego(id) {
    return new Promise(async (resolve, reject) => {
      try {
        await removerTrafego(useLogin.state.auth.token, id);
        removerDasListasSemSaida(id);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  registrarSaidaManual(id, portariaId) {
    return new Promise(async (resolve, reject) => {
      try {
        await registrarSaidaManual(useLogin.state.auth.token, id, portariaId);
        removerDasListasSemSaida(id);
        resolve();
        // o veículo passa a aparecer no histórico; atualiza contadores das abas em segundo plano
        actions.carregarServico().catch(() => {});
        actions.carregarHistorico().catch(() => {});
      } catch (error) {
        reject(error);
      }
    });
  },

  // remove localmente um tráfego que recebeu saída (ex.: associação manual)
  removerDasListasSemSaida(id) {
    removerDasListasSemSaida(id);
  },

  limparTrafegoSessao() {
    Object.assign(_state.trafegos, cloneDeep(initialState.trafegos));
    useClientes.actions.selecionarCliente(null);
  },
};

const removerDasListasSemSaida = (id) => {
  _state.trafegos.lista = _state.trafegos.lista.filter((c) => c.id !== id);
  _state.trafegos.semSaida = _state.trafegos.semSaida.filter((c) => c.id !== id);
  const servico = _state.trafegos.servico;
  if (servico.rows.find((c) => c.id === id)) {
    servico.rows = servico.rows.filter((c) => c.id !== id);
    servico.total = Math.max(0, servico.total - 1);
  }
};

// timer para calculo da permanencia do veículo
const calcPermanencia = () => {
  let alarmou = false;
  for (const trafego of _state.trafegos.lista) {
    trafego.permanencia = calcularPermanencia(trafego.dataEntrada);
    if (trafego.permanencia > '00:03:00' && trafego.destino === 'cruzar' && !trafego.in_whitelist) {
      alarmou = true;
    }
  }
  for (const trafego of [..._state.trafegos.servico.rows, ..._state.trafegos.semSaida]) {
    trafego.permanencia = calcularPermanencia(trafego.dataEntrada);
  }
  if (alarmou) {
    playAlarme();
  }
};
setInterval(calcPermanencia, 1000);

// timer para recarregar os trafegos
const recarregarTrafegos = async () => {
  if (useClientes.state.clientes.selecionado) {
    try {
      await actions.carregarTrafegos(useClientes.state.clientes.selecionado.id);
    } catch (error) {
      // tenta novamente no próximo ciclo
      console.log('Erro recarregando trafegos', error);
    }
  }
};
setInterval(recarregarTrafegos, 5000);

// audio
var audio = new Audio('alarme.wav');
let playing = false;
audio.onended = function () {
  playing = false;
};
const playAlarme = () => {
  if (useClientes.state.clientes.selecionado.tocar_alarme) {
    if (!playing) {
      console.log('Tocando alarme!');
      audio.play();
    }
  }
};

useLogin.actions.setLimparTrafegoSessao(actions.limparTrafegoSessao);

export default { state: state, actions };
