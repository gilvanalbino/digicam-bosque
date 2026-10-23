<template>
  <!-- Detalhe do alerta: explicação, evidências, histórico do veículo e revisão -->
  <ModalDialog :show="showDetalhe" larga>
    <div v-if="!detalhe">
      <p class="text-sm text-gray-500">Carregando…</p>
      <div class="mt-4 flex justify-end">
        <button type="button" @click="showDetalhe = false" class="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50">Fechar</button>
      </div>
    </div>
    <div v-else>
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
          <p class="mt-2 rounded-md border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-base font-semibold text-gray-900">{{ item.texto }}</p>
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
</template>

<script>
import { ref, computed, watch } from 'vue';
import { notify } from 'notiwind';

import ModalDialog from './ModalDialog.vue';

import useLogin from '../composables/useLogin';
import usePortarias from '../composables/usePortarias';
import useSinaisVeiculo from '../composables/useSinaisVeiculo';

import { obterAnomalia, obterHistoricoDaPlaca, revisarAnomalia } from '../database/dbAnomalias';

import { formatarData, calcularPermanencia } from '../utils/dateUtil';
import { FAIXAS, STATUS, DIMENSOES, PERFIS, REFERENCIAS, formatarDuracao, explicarAnomalia } from '../utils/anomaliaUtil';

// Relatório de um alerta de anomalia: explicação, evidências, histórico do veículo e revisão. Fica montado uma
// vez no layout e abre a pedido de qualquer tela (useSinaisVeiculo.abrirAnomalia).
export default {
  components: { ModalDialog },
  setup() {
    const mapPortaria = computed(() => usePortarias.state.portarias.map);
    const nomePortaria = (id) => (id && mapPortaria.value[id] ? mapPortaria.value[id].nome : '');
    // baixa manual conta como entrada sem saída: nenhuma câmera leu o veículo saindo
    const temSaidaLida = (trafego) => Boolean(trafego.dataSaida && trafego.identificador_placa_saida);

    const faixa = (alerta) => FAIXAS[alerta.faixa] || FAIXAS.normal;
    const formatarDia = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

    const showDetalhe = ref(false);
    const detalhe = ref(null);
    const trafegoDoEvento = ref(null);
    const saidaDoEvento = ref(null);
    const historico = ref(null);
    const motivo = ref('');
    const processando = ref(false);
    let idAberto = null;

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

    const abrir = async (id) => {
      idAberto = id;
      detalhe.value = null;
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
        const ret = await obterAnomalia(token, id);
        if (idAberto !== id) return;
        if (ret.status !== 'OK') throw new Error(ret.message);
        detalhe.value = ret.anomalia;
        trafegoDoEvento.value = ret.trafego;
        saidaDoEvento.value = ret.saida || null;
        const hist = await obterHistoricoDaPlaca(token, ret.anomalia.client_id, ret.anomalia.placa);
        if (idAberto === id) historico.value = hist;
      } catch (error) {
        if (idAberto === id && !detalhe.value) showDetalhe.value = false;
        notify({ group: 'error', title: 'Erro', text: 'Erro carregando o detalhe do alerta' }, 4000);
      }
    };

    watch(
      () => useSinaisVeiculo.state.pedido,
      (pedido) => {
        if (pedido) abrir(pedido.id);
      }
    );

    const revisar = async (resultado) => {
      if (processando.value || !detalhe.value) return;
      processando.value = true;
      try {
        const ret = await revisarAnomalia(useLogin.state.auth.token, detalhe.value.id, resultado, motivo.value);
        if (ret.status !== 'OK') throw new Error(ret.message);
        notify({ group: 'success', title: 'Sucesso', text: `Alerta da placa ${detalhe.value.placa}: ${STATUS[resultado].titulo.toLowerCase()}` }, 4000);
        showDetalhe.value = false;
        useSinaisVeiculo.anomaliaRevisada();
      } catch (error) {
        notify({ group: 'error', title: 'Erro', text: error.message || 'Erro registrando a revisão' }, 4000);
      } finally {
        processando.value = false;
      }
    };

    return {
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
      nomePortaria,
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
      revisar,
    };
  },
};
</script>
