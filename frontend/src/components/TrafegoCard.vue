<template>
  <div
      class="relative rounded-lg border border-gray-300 bg-white px-2 py-2 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
      :class="[classeAlerta, destacado ? 'ring-4 ring-indigo-500 border-indigo-500' : placaParecida ? 'ring-2 ring-amber-400 border-amber-400' : '']"
      @click="$emit('abrir', trafego)">
    <div class="flex-shrink-0">
      <img class="rounded-lg" :class="compacto ? 'h-14 w-14' : 'h-20 w-20'" :src="`/images${trafego.imagem_thumb}`" alt="" draggable="false" />
    </div>
    <div class="flex-1 min-w-0">
      <a href="#" class="focus:outline-none" draggable="false" @click.prevent>
        <span class="absolute inset-0" aria-hidden="true" />
        <p>
          <span class="text-lg font-bold text-gray-900 mr-2">
            {{ trafego.placa }}
          </span>
          <span v-if="trafego.nome" class="text-base font-bold text-gray-400">
            {{ trafego.nome }}
          </span>
          <SinaisVeiculo :placa="trafego.placa" :quando="trafego.dataEntrada" class="ml-1" />
        </p>
        <p v-if="mapPortaria[trafego.portaria_entrada_id]" class="text-xs text-green-700 font-bold truncate">
          Entrada: {{ mapPortaria[trafego.portaria_entrada_id].nome }}
        </p>
        <p class="text-xs text-green-700  truncate">
          {{ formatarData(trafego.dataEntrada) }}
        </p>
        <p class="text-xs text-green-700  truncate">
          Permanência: {{ trafego.permanencia }}
        </p>
        <p v-if="trafego.destino=='morador' && mapMoradores[trafego.morador_destino_id]" class="text-xs text-green-500 font-bold truncate">
          Morador: {{ mapMoradores[trafego.morador_destino_id].nome }} {{ mapMoradores[trafego.morador_destino_id].endereco }}
        </p>
        <p v-if="trafego.destino=='morador' && !mapMoradores[trafego.morador_destino_id]" class="text-xs text-green-500 font-bold truncate">
          Visitante
        </p>
        <p v-if="trafego.destino=='cruzar'" class="text-xs text-red-500 font-bold truncate">
          Cruzar condomínio
        </p>
        <p v-if="trafego.destino=='servico'" class="text-xs text-blue-500 font-bold truncate">
          Serviço
        </p>
        <p v-if="!compacto" class="text-sm text-gray-400 italic">
          {{ trafego.observacao }}
        </p>
      </a>
      <button v-if="mostrarRegistrarSaida" type="button" @click.stop="$emit('registrarSaida', trafego)"
          class="relative z-10 mt-1 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
        Registrar Saída
      </button>
      <button v-if="saidaParaAssociar" type="button" @click.stop="$emit('associarSaida', trafego)"
          class="relative z-10 mt-1 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        Associar saída {{ saidaParaAssociar.placa }}
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

import SinaisVeiculo from './SinaisVeiculo.vue';

import { formatarData } from '../utils/dateUtil';

export default {
  components: { SinaisVeiculo },
  props: {
    trafego: { type: Object, required: true },
    mapPortaria: { type: Object, default: () => ({}) },
    mapMoradores: { type: Object, default: () => ({}) },
    mostrarRegistrarSaida: { type: Boolean, default: false },
    compacto: { type: Boolean, default: false },
    destacado: { type: Boolean, default: false },
    // saída sem entrada selecionada no painel lateral: exibe o botão para associá-la a esta entrada
    saidaParaAssociar: { type: Object, default: null },
    placaParecida: { type: Boolean, default: false },
  },
  emits: ['abrir', 'registrarSaida', 'associarSaida'],
  setup(props) {
    const classeAlerta = computed(() => {
      const trafego = props.trafego;
      // em travessia há mais de 3 minutos: o vermelho escurece com o tempo (3–10 min, 10 min–2 h, mais de 2 h)
      if (trafego.destino === 'cruzar' && !trafego.in_whitelist) {
        const [horas, minutos, segundos] = String(trafego.permanencia || '').split(':').map(Number);
        const permanenciaS = horas * 3600 + minutos * 60 + segundos;
        if (permanenciaS > 2 * 3600) return 'alarm-longo';
        if (permanenciaS > 10 * 60) return 'alarm';
        if (permanenciaS > 3 * 60) return 'alarm-recente';
      }
      if (trafego.in_whitelist) {
        return 'white-list';
      }
      if (trafego.in_blacklist) {
        return 'black-list';
      }
      return '';
    });

    return {
      classeAlerta,
      formatarData,
    };
  },
};
</script>

<style>
  .alarm-recente {
    background-color: #ffd9d9;
  }

  .alarm {
    background-color: #ffadad;
  }

  .alarm-longo {
    background-color: #ff8a8a;
  }

  .white-list {
    background-color: rgb(200, 246, 200);
  }

  .black-list {
    background-color: rgb(255, 4, 0);
  }

  .black-list .text-green-700 {
    color: white;
  }

  .black-list .text-gray-400 {
    color: white;
  }

</style>
