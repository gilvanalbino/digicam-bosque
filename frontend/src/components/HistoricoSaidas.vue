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
      Saídas registradas hoje ({{ dataDeHoje() }}): total: {{ historico.total || 0 }}
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
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Foto entrada</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Foto saída</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placa</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <button type="button" class="inline-flex items-center gap-1 uppercase hover:text-gray-700" @click="alternarOrdem">
              Entrada / Saída <span aria-hidden="true">{{ historico.ordem === 'saida_desc' ? '▼' : '▲' }}</span>
              <span class="sr-only">{{ historico.ordem === 'saida_desc' ? 'saídas mais recentes primeiro' : 'saídas mais antigas primeiro' }}</span>
            </button>
          </th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permanência</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registro</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr v-for="trafego in historico.rows" :key="trafego.id" class="hover:bg-gray-50 cursor-pointer" @click="visualizarImagem(trafego)">
          <td class="px-4 py-2 whitespace-nowrap">
            <img v-if="trafego.imagem_thumb" class="h-12 w-12 rounded-lg" :src="`/images${trafego.imagem_thumb}`" alt="Foto da entrada" />
            <div v-else class="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">sem foto</div>
          </td>
          <td class="px-4 py-2 whitespace-nowrap">
            <img v-if="trafego.imagem_saida_thumb" class="h-12 w-12 rounded-lg" :src="`/images${trafego.imagem_saida_thumb}`" alt="Foto da saída" />
            <div v-else class="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">sem foto</div>
          </td>
          <td class="px-4 py-2 whitespace-nowrap">
            <div class="text-sm font-bold text-gray-900">{{ trafego.placa }}</div>
            <div v-if="trafego.placa_saida && trafego.placa_saida !== trafego.placa" class="text-xs text-gray-400">
              lida na saída: {{ trafego.placa_saida }}
            </div>
            <div v-if="trafego.nome" class="text-xs text-gray-400">{{ trafego.nome }}</div>
          </td>
          <td class="px-4 py-2 whitespace-nowrap text-sm">
            <div class="text-green-700">
              {{ formatarHora(trafego.dataEntrada) }}
              <span v-if="diaDaEntrada(trafego)" class="ml-1 rounded bg-amber-100 px-1 text-xs font-medium text-amber-800">{{ diaDaEntrada(trafego) }}</span>
              <span class="ml-1 text-xs">{{ nomePortaria(trafego.portaria_entrada_id) }}</span>
            </div>
            <div class="text-red-700">
              {{ formatarHora(trafego.dataSaida) }}
              <span class="ml-1 text-xs">{{ nomePortaria(trafego.portaria_saida_id) }}</span>
            </div>
          </td>
          <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{{ calcularPermanencia(trafego.dataEntrada, trafego.dataSaida) }}</td>
          <td class="px-4 py-2 whitespace-nowrap text-sm">
            <span :class="tipo(trafego).classe">{{ tipo(trafego).texto }}</span>
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

import { formatarHora, calcularPermanencia } from '../utils/dateUtil';

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

    // a data do histórico fica no título; as linhas mostram só os horários
    const dataDeHoje = () => new Date().toLocaleDateString('pt-BR');

    // sinaliza a entrada feita em dia anterior ao da saída: "ontem" ou a data curta (dd/mm)
    const diaDaEntrada = (trafego) => {
      const inicioDoDia = (data) => new Date(new Date(data).setHours(0, 0, 0, 0)).getTime();
      const dias = Math.round((inicioDoDia(trafego.dataSaida) - inicioDoDia(trafego.dataEntrada)) / 86400000);
      if (dias <= 0) return '';
      if (dias === 1) return 'ontem';
      return new Date(trafego.dataEntrada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    const nomePortaria = (id) => (mapPortaria.value[id] ? mapPortaria.value[id].nome : '');

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
      dataDeHoje,
      diaDaEntrada,
      nomePortaria,
      formatarHora,
      paginar,
      tipo,
      calcularPermanencia,
      trafegoSelecionado,
      showModal,
      visualizarImagem,
    };
  },
};
</script>
