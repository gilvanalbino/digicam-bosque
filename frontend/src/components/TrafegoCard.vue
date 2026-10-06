<template>
  <div
      class="relative rounded-lg border border-gray-300 bg-white px-2 py-2 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
      :class="[classeAlerta, destacado ? 'ring-4 ring-indigo-500 border-indigo-500' : '']"
      @click="$emit('abrir', trafego)">
    <div class="flex-shrink-0">
      <img class="rounded-lg" :class="compacto ? 'h-14 w-14' : 'h-20 w-20'" :src="`/images${trafego.imagem_thumb}`" alt="" />
    </div>
    <div class="flex-1 min-w-0">
      <a href="#" class="focus:outline-none" @click.prevent>
        <span class="absolute inset-0" aria-hidden="true" />
        <p>
          <span class="text-lg font-bold text-gray-900 mr-2">
            {{ trafego.placa }}
          </span>
          <span v-if="trafego.nome" class="text-base font-bold text-gray-400">
            {{ trafego.nome }}
          </span>
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
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

import { formatarData } from '../utils/dateUtil';

export default {
  props: {
    trafego: { type: Object, required: true },
    mapPortaria: { type: Object, default: () => ({}) },
    mapMoradores: { type: Object, default: () => ({}) },
    mostrarRegistrarSaida: { type: Boolean, default: false },
    compacto: { type: Boolean, default: false },
    destacado: { type: Boolean, default: false },
  },
  emits: ['abrir', 'registrarSaida'],
  setup(props) {
    const classeAlerta = computed(() => {
      const trafego = props.trafego;
      if (trafego.permanencia > '00:03:00' && trafego.destino === 'cruzar' && !trafego.in_whitelist) {
        return 'alarm';
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
  .alarm {
    -webkit-animation: ALERT-ANIMATION 1s infinite; /* Safari 4+ */
    -moz-animation:    ALERT-ANIMATION 1s infinite; /* Fx 5+ */
    -o-animation:      ALERT-ANIMATION 1s infinite; /* Opera 12+ */
    animation:         ALERT-ANIMATION 1s infinite; /* IE 10+, Fx 29+ */
  }

  @-webkit-keyframes ALERT-ANIMATION {
    0%, 49% {
        background-color: white;
    }
    50%, 100% {
        background-color: #ffadad;
    }
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
