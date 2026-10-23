<template>
  <span v-if="anomalia || primeiraVez" class="relative z-10 inline-flex items-center gap-1 align-middle">
    <button v-if="anomalia" type="button" :title="tituloAnomalia" :aria-label="tituloAnomalia" draggable="false"
        class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow ring-1 hover:ring-2 focus:outline-none focus:ring-2"
        :class="COR[anomalia.faixa] || COR.observacao" @click.stop.prevent="abrir">
      <ExclamationIcon class="h-4 w-4" aria-hidden="true" />
    </button>
    <span v-if="primeiraVez" class="whitespace-nowrap rounded-full bg-violet-600 px-1.5 py-0.5 text-xs font-bold leading-none text-white"
        title="Primeira passagem desta placa registrada no condomínio">1ª vez</span>
  </span>
</template>

<script>
import { computed, watch, onUnmounted } from 'vue';
import { ExclamationIcon } from '@heroicons/vue/solid';

import useSinaisVeiculo from '../composables/useSinaisVeiculo';
import { formatarData } from '../utils/dateUtil';
import { FAIXAS } from '../utils/anomaliaUtil';

const COR = {
  observacao: 'text-amber-500 ring-amber-400',
  revisao: 'text-orange-600 ring-orange-500',
  prioridade_alta: 'text-red-600 ring-red-500',
};

// Sinais de um card de veículo: ícone de atenção quando a placa tem alerta de anomalia (o clique abre o
// relatório do alerta mais recente) e a marca "1ª vez" quando a passagem do card é a primeira da placa.
export default {
  components: { ExclamationIcon },
  props: {
    placa: { type: String, default: '' },
    // data da passagem mostrada no card; a marca de primeira vez aparece quando não há passagem anterior a ela
    quando: { type: [String, Date, Number], default: null },
  },
  setup(props) {
    watch(
      () => props.placa,
      (nova, antiga) => {
        if (antiga) useSinaisVeiculo.liberar(antiga);
        if (nova) useSinaisVeiculo.registrar(nova);
      },
      { immediate: true }
    );
    onUnmounted(() => {
      if (props.placa) useSinaisVeiculo.liberar(props.placa);
    });

    const sinal = computed(() => useSinaisVeiculo.sinalDaPlaca(props.placa));
    const anomalia = computed(() => (sinal.value ? sinal.value.anomalia : null));
    const primeiraVez = computed(() => {
      if (!sinal.value || !sinal.value.primeira_passagem || !props.quando) return false;
      return new Date(props.quando).getTime() <= new Date(sinal.value.primeira_passagem).getTime() + 1000;
    });
    const tituloAnomalia = computed(() =>
      anomalia.value
        ? `Anomalia detectada em ${formatarData(anomalia.value.ocorrido_em)} (${(FAIXAS[anomalia.value.faixa] || FAIXAS.normal).titulo.toLowerCase()}). Clique para ver o relatório.`
        : ''
    );
    const abrir = () => useSinaisVeiculo.abrirAnomalia(anomalia.value.id);

    return { COR, anomalia, primeiraVez, tituloAnomalia, abrir };
  },
};
</script>
