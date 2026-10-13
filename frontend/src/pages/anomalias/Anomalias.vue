<template>
  <!-- Detalhe do alerta: explicação, evidências, histórico do veículo e revisão -->
  <ModalDialog :show="showDetalhe" larga>
    <div v-if="detalhe">
      <div class="flex flex-wrap items-center gap-3">
        <h3 class="text-2xl font-bold text-gray-900">{{ detalhe.placa }}</h3>
        <span class="rounded-full px-3 py-1 text-sm font-bold" :class="faixa(detalhe).classe">
          {{ faixa(detalhe).titulo }} · {{ Math.round(detalhe.score) }}
        </span>
        <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="STATUS[detalhe.status].classe">{{ STATUS[detalhe.status].titulo }}</span>
        <span v-if="detalhe.qualidade_dados.green_list" class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Green list</span>
        <span v-if="detalhe.qualidade_dados.red_list" class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Red list</span>
      </div>
      <p class="mt-1 text-sm text-gray-600">
        {{ formatarData(detalhe.ocorrido_em) }} ·
        {{ detalhe.evidencias.evento.sentido === 'E' ? 'entrada' : 'saída' }}
        {{ nomePortaria(detalhe.evidencias.evento.portaria) }}
        <template v-if="detalhe.evidencias.eventos_no_dia > 1"> · {{ detalhe.evidencias.eventos_no_dia }} passagens com desvio neste dia</template>
      </p>
      <p class="mt-1 text-xs text-gray-500">
        Indicador de comportamento atípico para apoiar a revisão humana. Não indica risco nem justifica, sozinho, abordagem ou bloqueio.
      </p>

      <!-- Por que este alerta -->
      <h4 class="mt-5 text-sm font-bold text-gray-900">Por que este alerta</h4>
      <ul class="mt-2 space-y-3">
        <li v-for="item in explicacoes" :key="item.dimensao">
          <div class="flex items-center gap-3">
            <span class="w-28 flex-shrink-0 text-xs font-medium text-gray-700">{{ DIMENSOES[item.dimensao] || 'Persistência' }}</span>
            <span class="h-2 flex-1 rounded-full bg-gray-100">
              <span class="block h-2 rounded-full bg-indigo-500" :style="{ width: `${Math.round(item.score)}%` }"></span>
            </span>
            <span class="w-8 flex-shrink-0 text-right text-xs font-medium text-gray-700">{{ Math.round(item.score) }}</span>
          </div>
          <p class="mt-1 text-sm text-gray-800">{{ item.texto }}</p>
          <p v-if="item.referencia" class="text-xs text-gray-500">Comparado com: {{ REFERENCIAS[item.referencia] }}.</p>
        </li>
      </ul>
      <p v-if="explicacoes.length === 0" class="mt-2 text-sm text-gray-500">Nenhuma dimensão com desvio.</p>

      <!-- Observado x referência -->
      <h4 class="mt-5 text-sm font-bold text-gray-900">Observado e referência</h4>
      <div class="mt-2 overflow-x-auto rounded-lg border border-gray-200">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr><th class="px-3 py-2">Dimensão</th><th class="px-3 py-2">Observado</th><th class="px-3 py-2">Referência</th><th class="px-3 py-2">Amostra</th></tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr v-for="linha in comparacoes" :key="linha.titulo">
              <td class="px-3 py-2 font-medium text-gray-900">{{ linha.titulo }}</td>
              <td class="px-3 py-2">{{ linha.observado }}</td>
              <td class="px-3 py-2 text-gray-600">{{ linha.referencia }}</td>
              <td class="px-3 py-2 text-gray-600">{{ linha.amostra }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-gray-500">
        Perfil: {{ PERFIS[detalhe.qualidade_dados.perfil] || detalhe.qualidade_dados.perfil }} ·
        {{ detalhe.qualidade_dados.passagens_no_historico }} passagens nos 90 dias anteriores
        <template v-if="detalhe.qualidade_dados.historico_insuficiente"> · <b class="text-amber-700">histórico próprio insuficiente</b></template>
        <template v-if="detalhe.qualidade_dados.placa_saida_diferente"> · placa lida na saída diferente da entrada</template>
        · modelo {{ detalhe.versao_modelo }}
      </p>
      <p v-if="detalhe.evidencias.repeticoes && detalhe.evidencias.repeticoes.length" class="mt-1 text-xs text-gray-500">
        A mesma anomalia se repetiu em: {{ detalhe.evidencias.repeticoes.map((r) => formatarDia(r.dia)).join(', ') }}.
      </p>

      <!-- Fotos do tráfego do evento -->
      <div v-if="trafegoDoEvento" class="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p class="text-xs font-bold uppercase text-green-700">Entrada · {{ formatarData(trafegoDoEvento.dataEntrada) }}</p>
          <img v-if="trafegoDoEvento.imagem" class="mt-1 rounded-lg" :src="`/images${trafegoDoEvento.imagem}`" alt="Foto da entrada" />
          <div v-else class="mt-1 flex h-24 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">Sem imagem</div>
        </div>
        <div>
          <p class="text-xs font-bold uppercase text-red-700">Saída · {{ trafegoDoEvento.dataSaida ? formatarData(trafegoDoEvento.dataSaida) : 'sem saída' }}</p>
          <img v-if="trafegoDoEvento.imagem_saida" class="mt-1 rounded-lg" :src="`/images${trafegoDoEvento.imagem_saida}`" alt="Foto da saída" />
          <div v-else class="mt-1 flex h-24 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">Sem imagem</div>
        </div>
      </div>

      <!-- Evento que é uma saída sem entrada identificada: só existe a foto da saída -->
      <div v-else-if="saidaDoEvento" class="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p class="text-xs font-bold uppercase text-green-700">Entrada</p>
          <div class="mt-1 flex h-24 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">Sem entrada identificada</div>
        </div>
        <div>
          <p class="text-xs font-bold uppercase text-red-700">Saída · {{ formatarData(saidaDoEvento.data) }}</p>
          <img v-if="saidaDoEvento.imagem_carro" class="mt-1 rounded-lg" :src="`/images${saidaDoEvento.imagem_carro}`" alt="Foto da saída" />
          <div v-else class="mt-1 flex h-24 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">Sem imagem</div>
        </div>
      </div>

      <!-- Histórico do veículo -->
      <h4 class="mt-5 text-sm font-bold text-gray-900">Histórico do veículo</h4>
      <p v-if="!historico" class="mt-2 text-sm text-gray-500">Carregando…</p>
      <template v-else>
        <p class="mt-1 text-xs text-gray-500">
          {{ historico.alertas.length }} alerta(s) desta placa
          <template v-if="historico.referencias.length">
            · referência atual: mediana de {{ formatarDuracao(historico.referencias[0].duracao_mediana) }} em {{ historico.referencias[0].qtd_viagens }} viagens
          </template>
        </p>
        <div class="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-200">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr><th class="px-3 py-2">Foto</th><th class="px-3 py-2">Entrada</th><th class="px-3 py-2">Saída</th><th class="px-3 py-2">Permanência</th></tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
              <tr v-for="linha in linhasHistorico" :key="linha.chave" :class="linha.doEvento ? 'bg-indigo-50' : ''">
                <td class="px-3 py-1">
                  <img v-if="linha.miniatura" class="h-10 w-10 rounded" :src="`/images${linha.miniatura}`" alt="" loading="lazy" />
                </td>
                <template v-if="linha.trafego">
                  <td class="px-3 py-1 text-green-700">{{ formatarData(linha.trafego.dataEntrada) }} <span class="text-xs">{{ nomePortaria(linha.trafego.portaria_entrada_id) }}</span></td>
                  <td class="px-3 py-1 text-red-700">
                    <template v-if="temSaidaLida(linha.trafego)">{{ formatarData(linha.trafego.dataSaida) }} <span class="text-xs">{{ nomePortaria(linha.trafego.portaria_saida_id) }}</span></template>
                    <span v-else class="text-gray-400">sem saída</span>
                  </td>
                  <td class="px-3 py-1">{{ temSaidaLida(linha.trafego) ? calcularPermanencia(linha.trafego.dataEntrada, linha.trafego.dataSaida) : '' }}</td>
                </template>
                <template v-else>
                  <td class="px-3 py-1 text-gray-400">sem entrada identificada</td>
                  <td class="px-3 py-1 text-red-700">{{ formatarData(linha.saida.data) }} <span class="text-xs">{{ nomePortaria(linha.saida.Camera ? linha.saida.Camera.portaria_id : null) }}</span></td>
                  <td class="px-3 py-1"></td>
                </template>
              </tr>
              <tr v-if="linhasHistorico.length === 0"><td colspan="4" class="px-3 py-2 text-gray-500">Nenhuma passagem registrada com esta placa.</td></tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Revisões -->
      <h4 class="mt-5 text-sm font-bold text-gray-900">Revisão</h4>
      <ul v-if="detalhe.revisoes && detalhe.revisoes.length" class="mt-2 space-y-1 text-sm">
        <li v-for="revisao in detalhe.revisoes" :key="revisao.id" class="text-gray-700">
          <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="STATUS[revisao.resultado].classe">{{ STATUS[revisao.resultado].titulo }}</span>
          {{ formatarData(revisao.revisado_em) }} · {{ revisao.User ? revisao.User.name : '' }}
          <span v-if="revisao.motivo" class="text-gray-500">— {{ revisao.motivo }}</span>
        </li>
      </ul>
      <label for="anomalia-motivo" class="mt-3 block text-xs font-medium text-gray-500">Observação da revisão (opcional)</label>
      <input id="anomalia-motivo" type="text" v-model="motivo" maxlength="255"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500" />
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" @click="showDetalhe = false" class="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50">Fechar</button>
        <button type="button" :disabled="processando" @click="revisar('REVISADA')" class="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Marcar como revisada</button>
        <button type="button" :disabled="processando" @click="revisar('DESCARTADA')" class="px-3 py-2 rounded-md bg-gray-600 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">Descartar</button>
        <button type="button" :disabled="processando" @click="revisar('CONFIRMADA')" class="px-3 py-2 rounded-md bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Relevante</button>
      </div>
    </div>
  </ModalDialog>

  <Main titulo="Anomalias" menu="Anomalias">
    <hr class="mt-5 mb-5 bg-gray-400"/>

    <div v-if="!administrador" class="text-sm text-gray-600">Os alertas de anomalia são visíveis somente para administradores.</div>

    <template v-else>
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
          <label for="anomalia-de" class="block text-xs font-medium text-gray-500">De</label>
          <input id="anomalia-de" type="date" v-model="filtros.de" class="mt-1 block rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500" />
        </div>
        <div>
          <label for="anomalia-ate" class="block text-xs font-medium text-gray-500">Até</label>
          <input id="anomalia-ate" type="date" v-model="filtros.ate" class="mt-1 block rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500" />
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
    </template>
  </Main>
</template>

<script>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { notify } from 'notiwind';
import debounce from 'lodash/debounce';

import Main from '../layout/Main.vue';
import ModalDialog from '../../components/ModalDialog.vue';
import Paginacao from '../../components/Paginacao.vue';

import useLogin from '../../composables/useLogin';
import useClientes from '../../composables/useClientes';
import usePortarias from '../../composables/usePortarias';

import {
  listarAnomalias,
  obterAnomalia,
  obterHistoricoDaPlaca,
  obterMetricasAnomalias,
  revisarAnomalia,
} from '../../database/dbAnomalias';

import { formatarData, calcularPermanencia } from '../../utils/dateUtil';
import {
  FAIXAS,
  STATUS,
  DIMENSOES,
  PERFIS,
  REFERENCIAS,
  formatarDuracao,
  explicarAnomalia,
  resumirAnomalia,
} from '../../utils/anomaliaUtil';

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
  components: { Main, ModalDialog, Paginacao },
  setup() {
    const usuario = computed(() => useLogin.state.auth.user || {});
    const administrador = computed(() => !!(usuario.value.admin || usuario.value.admin_client));
    const clienteId = () => useClientes.state.clientes.selecionado && useClientes.state.clientes.selecionado.id;
    const mapPortaria = computed(() => usePortarias.state.portarias.map);
    const nomePortaria = (id) => (id && mapPortaria.value[id] ? mapPortaria.value[id].nome : '');
    // baixa manual conta como entrada sem saída: nenhuma câmera leu o veículo saindo
    const temSaidaLida = (trafego) => Boolean(trafego.dataSaida && trafego.identificador_placa_saida);

    const faixa = (alerta) => FAIXAS[alerta.faixa] || FAIXAS.normal;
    const formatarDia = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

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
      if (!administrador.value || !clienteId()) return;
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
      if (!administrador.value || !clienteId()) return;
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

    // ---------- detalhe e revisão
    const showDetalhe = ref(false);
    const detalhe = ref(null);
    const trafegoDoEvento = ref(null);
    const saidaDoEvento = ref(null);
    const historico = ref(null);
    const motivo = ref('');
    const processando = ref(false);

    const explicacoes = computed(() => (detalhe.value ? explicarAnomalia(detalhe.value) : []));

    // tabela "observado e referência": todas as dimensões calculadas, com ou sem desvio
    const comparacoes = computed(() => {
      if (!detalhe.value) return [];
      const evidencias = detalhe.value.evidencias;
      const linhas = [];
      const duracao = evidencias.duracao;
      if (duracao) {
        linhas.push({
          titulo: 'Permanência',
          observado: formatarDuracao(duracao.valor_s),
          referencia: duracao.referencia
            ? `mediana ${formatarDuracao(duracao.mediana_s)}; 95% até ${formatarDuracao(duracao.p95_s)}`
            : 'sem referência',
          amostra: duracao.referencia === 'perfil' ? `${duracao.amostra_perfil} viagens do perfil` : `${duracao.amostra} viagens da placa`,
        });
      }
      const frequencia = evidencias.frequencia;
      if (frequencia) {
        const nomes = { h1: 'Passagens em 1 hora', h24: 'Passagens em 24 horas', d7: 'Passagens em 7 dias' };
        for (const [janela, dados] of Object.entries(frequencia.janelas)) {
          linhas.push({
            titulo: nomes[janela],
            observado: dados.valor,
            referencia: dados.mediana !== undefined ? `mediana ${dados.mediana}` : dados.p95 !== undefined ? `95% até ${dados.p95}; 99% até ${dados.p99}` : 'sem referência',
            amostra: dados.amostra !== undefined ? `${dados.amostra} períodos da placa` : frequencia.referencia === 'perfil' ? 'perfil' : '',
          });
        }
      }
      const horario = evidencias.horario;
      if (horario) {
        linhas.push({
          titulo: 'Horário',
          observado: `${horario.hora}h–${horario.hora + 1}h, ${horario.tipo_dia === 'fim_de_semana' ? 'fim de semana' : 'dia útil'}`,
          referencia: horario.referencia ? `${(horario.probabilidade * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das passagens nessa faixa` : 'sem referência',
          amostra: horario.referencia === 'perfil' ? `${horario.amostra_perfil} passagens do perfil` : `${horario.amostra} passagens da placa`,
        });
      }
      if (evidencias.rota) {
        linhas.push({
          titulo: 'Rota (informação)',
          observado: `${nomePortaria(evidencias.rota.portaria_entrada)} → ${nomePortaria(evidencias.rota.portaria_saida)}`,
          referencia: 'não pontua nesta versão',
          amostra: '',
        });
      }
      return linhas;
    });

    // histórico do veículo: tráfegos (entradas, com ou sem saída) e saídas sem entrada identificada, do mais
    // recente para o mais antigo
    const linhasHistorico = computed(() => {
      if (!historico.value) return [];
      const eventoSaidaId = detalhe.value && detalhe.value.evidencias && detalhe.value.evidencias.evento ? detalhe.value.evidencias.evento.saida_id : null;
      const dosTrafegos = (historico.value.trafegos || []).map((trafego) => ({
        chave: `t${trafego.id}`, quando: new Date(trafego.dataEntrada).getTime(), trafego, miniatura: trafego.imagem_thumb,
        doEvento: !!detalhe.value && trafego.id === detalhe.value.trafego_id,
      }));
      const dasSaidas = (historico.value.saidas || []).map((saida) => ({
        chave: `s${saida.id}`, quando: new Date(saida.data).getTime(), saida, miniatura: saida.imagem_carro_thumb,
        doEvento: !!eventoSaidaId && saida.id === eventoSaidaId,
      }));
      return [...dosTrafegos, ...dasSaidas].sort((a, b) => b.quando - a.quando);
    });

    const abrir = async (alerta) => {
      detalhe.value = alerta;
      trafegoDoEvento.value = null;
      saidaDoEvento.value = null;
      historico.value = null;
      motivo.value = '';
      // ModalDialog só reabre quando a prop muda
      showDetalhe.value = false;
      setTimeout(() => {
        showDetalhe.value = true;
      }, 100);
      try {
        const token = useLogin.state.auth.token;
        const ret = await obterAnomalia(token, alerta.id);
        if (ret.status === 'OK' && detalhe.value && detalhe.value.id === alerta.id) {
          detalhe.value = ret.anomalia;
          trafegoDoEvento.value = ret.trafego;
          saidaDoEvento.value = ret.saida || null;
        }
        const hist = await obterHistoricoDaPlaca(token, clienteId(), alerta.placa);
        if (detalhe.value && detalhe.value.id === alerta.id) historico.value = hist;
      } catch (error) {
        notify({ group: 'error', title: 'Erro', text: 'Erro carregando o detalhe do alerta' }, 4000);
      }
    };

    const revisar = async (resultado) => {
      if (processando.value || !detalhe.value) return;
      processando.value = true;
      try {
        const ret = await revisarAnomalia(useLogin.state.auth.token, detalhe.value.id, resultado, motivo.value);
        if (ret.status !== 'OK') throw new Error(ret.message);
        notify({ group: 'success', title: 'Sucesso', text: `Alerta da placa ${detalhe.value.placa}: ${STATUS[resultado].titulo.toLowerCase()}` }, 4000);
        showDetalhe.value = false;
        carregar();
        carregarMetricas();
      } catch (error) {
        notify({ group: 'error', title: 'Erro', text: error.message || 'Erro registrando a revisão' }, 4000);
      } finally {
        processando.value = false;
      }
    };

    onMounted(() => {
      carregar();
      carregarMetricas();
    });

    return {
      administrador,
      FAIXAS,
      STATUS,
      DIMENSOES,
      PERFIS,
      REFERENCIAS,
      faixa,
      formatarDia,
      formatarData,
      formatarDuracao,
      calcularPermanencia,
      temSaidaLida,
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
      showDetalhe,
      detalhe,
      trafegoDoEvento,
      saidaDoEvento,
      linhasHistorico,
      historico,
      explicacoes,
      comparacoes,
      motivo,
      processando,
      abrir,
      revisar,
    };
  },
};
</script>
