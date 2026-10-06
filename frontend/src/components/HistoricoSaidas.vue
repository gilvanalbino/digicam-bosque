<template>
  <ModalDialog :show="showModal">
    <p class="text-sm font-medium text-gray-500 mb-1">Entrada</p>
    <img :src="`/images${trafegoSelecionado.imagem}`" />
    <img v-if="trafegoSelecionado.imagem_placa" :src="`/images${trafegoSelecionado.imagem_placa}`" />
    <template v-if="trafegoSelecionado.imagem_saida">
      <p class="text-sm font-medium text-gray-500 mt-4 mb-1">Saída</p>
      <img :src="`/images${trafegoSelecionado.imagem_saida}`" />
      <img v-if="trafegoSelecionado.imagem_saida_placa" :src="`/images${trafegoSelecionado.imagem_saida_placa}`" />
    </template>
  </ModalDialog>

  <div class="flex flex-wrap items-end gap-4">
    <div>
      <label for="historico-placa" class="block text-xs font-medium text-gray-500">Placa</label>
      <input id="historico-placa" type="text" v-model="placa" v-maska="'XXXXXXX'" placeholder="Buscar placa"
          class="mt-1 block w-40 uppercase rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500" />
    </div>
    <h3 class="text-sm leading-4 italic font-medium text-gray-500 pb-2">
      Saídas registradas hoje (total: {{ historico.total || 0 }})
    </h3>
  </div>

  <div v-if="historico.novos > 0" class="mt-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700">
    {{ historico.novos }} {{ historico.novos === 1 ? 'nova saída registrada' : 'novas saídas registradas' }}.
    <a href="#" class="font-medium underline" @click.prevent="paginar(1)">Ver mais recentes</a>
  </div>

  <div v-if="historico.rows.length===0" class="mb-32 mt-4 text-sky-500">Nenhuma saída registrada hoje</div>

  <div v-else class="mt-4 shadow overflow-x-auto border-b border-gray-200 sm:rounded-lg">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagem</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placa</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entrada</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <button type="button" class="inline-flex items-center gap-1 uppercase hover:text-gray-700" @click="alternarOrdem">
              Saída <span aria-hidden="true">{{ historico.ordem === 'saida_desc' ? '▼' : '▲' }}</span>
              <span class="sr-only">{{ historico.ordem === 'saida_desc' ? 'mais recentes primeiro' : 'mais antigas primeiro' }}</span>
            </button>
          </th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permanência</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Portaria saída</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registro</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr v-for="trafego in historico.rows" :key="trafego.id" class="hover:bg-gray-50 cursor-pointer" @click="visualizarImagem(trafego)">
          <td class="px-4 py-2 whitespace-nowrap">
            <img class="h-12 w-12 rounded-lg" :src="`/images${trafego.imagem_saida_thumb || trafego.imagem_thumb}`" alt="" />
          </td>
          <td class="px-4 py-2 whitespace-nowrap">
            <div class="text-sm font-bold text-gray-900">{{ trafego.placa }}</div>
            <div v-if="trafego.placa_saida && trafego.placa_saida !== trafego.placa" class="text-xs text-gray-400">
              lida na saída: {{ trafego.placa_saida }}
            </div>
            <div v-if="trafego.nome" class="text-xs text-gray-400">{{ trafego.nome }}</div>
          </td>
          <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{{ formatarData(trafego.dataEntrada) }}</td>
          <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{{ formatarData(trafego.dataSaida) }}</td>
          <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{{ calcularPermanencia(trafego.dataEntrada, trafego.dataSaida) }}</td>
          <td class="px-4 py-2 whitespace-nowrap text-sm">
            <span :class="tipo(trafego).classe">{{ tipo(trafego).texto }}</span>
          </td>
          <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
            {{ mapPortaria[trafego.portaria_saida_id] ? mapPortaria[trafego.portaria_saida_id].nome : '' }}
          </td>
          <td class="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
            {{ trafego.saida_automatica ? 'Automático' : 'Manual' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <Paginacao :page="historico.page" :total="historico.total || 0" @change="paginar" />
</template>

<script>
import { ref, computed, watch } from 'vue';
import debounce from 'lodash/debounce';

import usePortarias from '../composables/usePortarias';
import useTrafegos from '../composables/useTrafegos';
import useMoradores from '../composables/useMoradores';

import { formatarData, calcularPermanencia } from '../utils/dateUtil';

import ModalDialog from './ModalDialog.vue';
import Paginacao from './Paginacao.vue';

export default {
  components: { ModalDialog, Paginacao },
  setup() {
    const historico = computed(() => useTrafegos.state.trafegos.historico);
    const mapPortaria = computed(() => usePortarias.state.portarias.map);
    const mapMoradores = computed(() => useMoradores.state.moradores.map);

    const placa = ref(historico.value.filtros.placa);
    watch(
      placa,
      debounce((valor) => {
        useTrafegos.actions.filtrarHistorico({ placa: valor });
      }, 400)
    );

    const alternarOrdem = () => {
      useTrafegos.actions.ordenarHistorico(historico.value.ordem === 'saida_desc' ? 'saida_asc' : 'saida_desc');
    };

    const paginar = (page) => {
      useTrafegos.actions.paginarHistorico(page);
    };

    const tipo = (trafego) => {
      if (trafego.destino === 'cruzar') {
        return { texto: 'Cruzar condomínio', classe: 'text-red-500 font-bold' };
      }
      if (trafego.destino === 'servico') {
        return { texto: 'Serviço', classe: 'text-blue-500 font-bold' };
      }
      if (trafego.destino === 'morador') {
        const morador = mapMoradores.value[trafego.morador_destino_id];
        return { texto: morador ? `Visitante: ${morador.nome}` : 'Visitante', classe: 'text-green-600 font-bold' };
      }
      return { texto: trafego.destino || '', classe: 'text-gray-500' };
    };

    const trafegoSelecionado = ref({});
    const showModal = ref(false);
    const visualizarImagem = (trafego) => {
      trafegoSelecionado.value = trafego;
      showModal.value = false;
      setTimeout(() => {
        showModal.value = true;
      }, 100);
    };

    return {
      historico,
      mapPortaria,
      placa,
      alternarOrdem,
      paginar,
      tipo,
      formatarData,
      calcularPermanencia,
      trafegoSelecionado,
      showModal,
      visualizarImagem,
    };
  },
};
</script>
