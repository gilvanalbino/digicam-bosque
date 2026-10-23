<template>
  <Main titulo="Anomalias" menu="Anomalias">
    <hr class="mt-5 mb-5 bg-gray-400"/>

    <!-- Métricas do detector -->
    <div v-if="metricas" class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div v-for="cartao in cartoes" :key="cartao.titulo" class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-xs font-medium text-gray-500">{{ cartao.titulo }}</p>
        <p class="mt-1 text-xl font-bold text-gray-900">{{ cartao.valor }}</p>
        <p class="text-xs text-gray-500">{{ cartao.detalhe }}</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="mt-5 flex flex-wrap items-end gap-4">
      <div>
        <label for="dp-input-anomalia-de" class="block text-xs font-medium text-gray-500">De</label>
        <CampoData id="anomalia-de" v-model="filtros.de" class="mt-1" />
      </div>
      <div>
        <label for="dp-input-anomalia-ate" class="block text-xs font-medium text-gray-500">Até</label>
        <CampoData id="anomalia-ate" v-model="filtros.ate" class="mt-1" />
      </div>
      <div>
        <label for="anomalia-faixa" class="block text-xs font-medium text-gray-500">Prioridade</label>
        <select id="anomalia-faixa" v-model="filtros.faixa" class="mt-1 block rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500">
          <option value="">Todas</option>
          <option value="prioridade_alta">Prioridade alta (80–100)</option>
          <option value="revisao">Revisão (60–79)</option>
          <option value="observacao">Observação (30–59)</option>
        </select>
      </div>
      <div>
        <label for="anomalia-status" class="block text-xs font-medium text-gray-500">Estado</label>
        <select id="anomalia-status" v-model="filtros.status" class="mt-1 block rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500">
          <option value="">Todos</option>
          <option value="ABERTA">Abertas</option>
          <option value="CONFIRMADA">Relevantes</option>
          <option value="DESCARTADA">Descartadas</option>
          <option value="REVISADA">Revisadas</option>
        </select>
      </div>
      <div>
        <label for="anomalia-placa" class="block text-xs font-medium text-gray-500">Placa</label>
        <input id="anomalia-placa" type="text" v-model="filtros.placa" v-maska="'XXXXXXX'" placeholder="Buscar placa"
            class="mt-1 block w-36 uppercase rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500" />
      </div>
      <div>
        <label for="anomalia-ordem" class="block text-xs font-medium text-gray-500">Ordem</label>
        <select id="anomalia-ordem" v-model="filtros.ordem" class="mt-1 block rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500">
          <option value="score">Maior pontuação</option>
          <option value="recente">Mais recentes</option>
        </select>
      </div>
      <p class="pb-2 text-sm italic text-gray-500">{{ total }} alerta(s)</p>
    </div>

    <div v-if="carregando && alertas.length === 0" class="mt-4 text-sm text-gray-500">Carregando…</div>
    <div v-else-if="alertas.length === 0" class="mt-4 mb-32 text-sky-500">Nenhum alerta com estes filtros</div>

    <div v-else class="mt-4 shadow overflow-x-auto border-b border-gray-200 sm:rounded-lg">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th v-for="coluna in ['Placa', 'Quando', 'Pontuação', 'Motivo principal', 'Estado']" :key="coluna" scope="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ coluna }}</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="alerta in alertas" :key="alerta.id" class="hover:bg-gray-50 cursor-pointer" @click="abrir(alerta)">
            <td class="px-4 py-2 whitespace-nowrap">
              <div class="text-sm font-bold text-gray-900">{{ alerta.placa }}</div>
              <div class="text-xs text-gray-400">{{ PERFIS[alerta.qualidade_dados.perfil] || '' }}</div>
            </td>
            <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{{ formatarData(alerta.ocorrido_em) }}</td>
            <td class="px-4 py-2 whitespace-nowrap">
              <span class="rounded-full px-2 py-0.5 text-xs font-bold" :class="faixa(alerta).classe">{{ Math.round(alerta.score) }} · {{ faixa(alerta).titulo }}</span>
            </td>
            <td class="px-4 py-2 text-sm text-gray-700">
              <span class="font-medium">{{ DIMENSOES[alerta.evidencias.composicao.principal] }}:</span>
              {{ resumirAnomalia(alerta) }}
              <span v-if="alerta.qualidade_dados.historico_insuficiente" class="ml-1 text-xs text-amber-700">histórico insuficiente</span>
              <span v-if="alerta.evidencias.repeticoes && alerta.evidencias.repeticoes.length" class="ml-1 text-xs text-gray-400">
                repetiu em {{ alerta.evidencias.repeticoes.length }} dia(s)
              </span>
            </td>
            <td class="px-4 py-2 whitespace-nowrap">
              <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="STATUS[alerta.status].classe">{{ STATUS[alerta.status].titulo }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Paginacao :page="page" :total="total" @change="paginar" />
  </Main>
</template>

<script>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { notify } from 'notiwind';
import debounce from 'lodash/debounce';

import Main from '../layout/Main.vue';
import Paginacao from '../../components/Paginacao.vue';
import CampoData from '../../components/CampoData.vue';

import useLogin from '../../composables/useLogin';
import useClientes from '../../composables/useClientes';
import usePortarias from '../../composables/usePortarias';
import useSinaisVeiculo from '../../composables/useSinaisVeiculo';

import { listarAnomalias, obterMetricasAnomalias } from '../../database/dbAnomalias';

import { formatarData } from '../../utils/dateUtil';
import { FAIXAS, STATUS, DIMENSOES, PERFIS, formatarDuracao, resumirAnomalia } from '../../utils/anomaliaUtil';

const diaIso = (data) => {
  const doisDigitos = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
};
// início do dia local informado no campo de data (AAAA-MM-DD), com deslocamento em dias
const inicioDoDia = (texto, deslocamento = 0) => {
  const [ano, mes, dia] = texto.split('-').map(Number);
  return new Date(ano, mes - 1, dia + deslocamento);
};

export default {
  components: { Main, Paginacao, CampoData },
  setup() {
    const clienteId = () => useClientes.state.clientes.selecionado && useClientes.state.clientes.selecionado.id;
    const mapPortaria = computed(() => usePortarias.state.portarias.map);
    const nomePortaria = (id) => (id && mapPortaria.value[id] ? mapPortaria.value[id].nome : '');

    const faixa = (alerta) => FAIXAS[alerta.faixa] || FAIXAS.normal;

    // ---------- lista
    const hoje = new Date();
    const filtros = reactive({
      de: diaIso(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6)),
      ate: diaIso(hoje),
      faixa: '',
      status: 'ABERTA',
      placa: '',
      ordem: 'score',
    });
    const alertas = ref([]);
    const total = ref(0);
    const page = ref(1);
    const carregando = ref(false);
    let sequencia = 0;

    const carregar = async () => {
      if (!clienteId()) return;
      const atual = ++sequencia;
      carregando.value = true;
      try {
        const parametros = { page: page.value, pageSize: 50, ordem: filtros.ordem };
        if (filtros.de) parametros.de = inicioDoDia(filtros.de).toISOString();
        if (filtros.ate) parametros.ate = inicioDoDia(filtros.ate, 1).toISOString();
        if (filtros.faixa) parametros.faixa = filtros.faixa;
        if (filtros.status) parametros.status = filtros.status;
        if (filtros.placa) parametros.placa = filtros.placa;
        const ret = await listarAnomalias(useLogin.state.auth.token, clienteId(), parametros);
        if (atual !== sequencia) return;
        alertas.value = ret.rows;
        total.value = ret.total;
      } catch (error) {
        notify({ group: 'error', title: 'Erro', text: 'Erro carregando os alertas de anomalia' }, 4000);
      } finally {
        if (atual === sequencia) carregando.value = false;
      }
    };

    watch(
      filtros,
      debounce(() => {
        page.value = 1;
        carregar();
      }, 400)
    );

    const paginar = (novaPagina) => {
      page.value = novaPagina;
      carregar();
    };

    // ---------- métricas
    const metricas = ref(null);
    const carregarMetricas = async () => {
      if (!clienteId()) return;
      try {
        const ret = await obterMetricasAnomalias(useLogin.state.auth.token, clienteId(), 14);
        metricas.value = ret.status === 'OK' ? ret : null;
      } catch (error) {
        metricas.value = null;
      }
    };

    const percentual = (valor) => (valor === null || valor === undefined ? '—' : `${Math.round(valor * 100)}%`);
    const cartoes = computed(() => {
      const m = metricas.value;
      if (!m) return [];
      const dias = Math.max(1, m.alertas_por_dia.length);
      const altos = m.alertas_por_dia.reduce((soma, dia) => soma + dia.revisao + dia.prioridade_alta, 0);
      const viagens = m.dados ? m.dados.viagens : null;
      // resumos gravados antes de a baixa manual contar como entrada sem saída trazem as duas chaves antigas
      const semSaida = viagens ? viagens.sem_saida ?? (viagens.aberta || 0) + (viagens.baixa_manual || 0) : 0;
      const comSaida = viagens ? Object.values(viagens).reduce((soma, n) => soma + n, 0) - semSaida : 0;
      return [
        { titulo: 'Alertas em 14 dias', valor: m.total_alertas, detalhe: `${Math.round(m.total_alertas / dias)} por dia, em média` },
        { titulo: 'Revisão ou prioridade alta', valor: altos, detalhe: `${Math.round(altos / dias)} por dia, em média` },
        { titulo: 'Aguardando revisão', valor: m.por_status.ABERTA, detalhe: `${m.por_status.CONFIRMADA} relevantes, ${m.por_status.DESCARTADA} descartados` },
        {
          titulo: 'Considerados relevantes', valor: percentual(m.proporcao_relevantes),
          detalhe: m.tempo_medio_revisao_s === null ? 'sem revisões concluídas' : `revisão em ${formatarDuracao(m.tempo_medio_revisao_s)}, em média`,
        },
        {
          titulo: 'Viagens válidas', valor: viagens && comSaida ? percentual(viagens.valida / comSaida) : '—',
          detalhe: m.atraso_medio_alerta_s === null ? 'das saídas lidas por câmera' : `alerta em ${formatarDuracao(m.atraso_medio_alerta_s)} após a passagem`,
        },
      ];
    });

    // o relatório do alerta fica no layout (DetalheAnomalia); a lista recarrega depois de uma revisão
    const abrir = (alerta) => useSinaisVeiculo.abrirAnomalia(alerta.id);
    watch(
      () => useSinaisVeiculo.state.revisoes,
      () => {
        carregar();
        carregarMetricas();
      }
    );

    onMounted(() => {
      carregar();
      carregarMetricas();
    });

    return {
      FAIXAS,
      STATUS,
      DIMENSOES,
      PERFIS,
      faixa,
      formatarData,
      formatarDuracao,
      resumirAnomalia,
      nomePortaria,
      filtros,
      alertas,
      total,
      page,
      carregando,
      paginar,
      metricas,
      cartoes,
      abrir,
    };
  },
};
</script>
