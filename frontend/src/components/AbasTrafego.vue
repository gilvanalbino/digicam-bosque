<template>
  <div class="border-b border-gray-200">
    <nav class="-mb-px flex flex-wrap gap-x-6" role="tablist" aria-label="Tráfego">
      <button v-for="aba in abas" :key="aba.id" type="button" role="tab"
          :id="`aba-${aba.id}`"
          :aria-selected="abaAtiva === aba.id"
          :aria-controls="`painel-${aba.id}`"
          @click="selecionar(aba.id)"
          :class="[abaAtiva === aba.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                   'whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm']">
        {{ aba.titulo }}
        <span v-if="aba.contador !== null"
            :class="[abaAtiva === aba.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-900', 'ml-2 py-0.5 px-2 rounded-full text-xs font-medium']">
          {{ aba.contador }}
        </span>
      </button>
    </nav>
  </div>

  <div class="mt-5" role="tabpanel" :id="`painel-${abaAtiva}`" :aria-labelledby="`aba-${abaAtiva}`">
    <ListaTrafego v-if="abaAtiva === 'travessia'"
        :trafegos="trafegos.lista"
        descricao="Veículos em travessia - entraram para cruzar o condomínio e ainda não saíram" />

    <template v-else-if="abaAtiva === 'servico'">
      <div class="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label for="servico-placa" class="block text-xs font-medium text-gray-500">Placa</label>
          <input id="servico-placa" type="text" v-model="filtroServico.placa" v-maska="'XXXXXXX'" placeholder="Buscar placa"
              class="mt-1 block w-40 uppercase rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500" />
        </div>
        <div>
          <label for="servico-entrada-de" class="block text-xs font-medium text-gray-500">Entrada a partir de</label>
          <input id="servico-entrada-de" type="time" v-model="filtroServico.entradaDe"
              class="mt-1 block rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500" />
        </div>
        <div>
          <label for="servico-entrada-ate" class="block text-xs font-medium text-gray-500">Entrada até</label>
          <input id="servico-entrada-ate" type="time" v-model="filtroServico.entradaAte"
              class="mt-1 block rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500" />
        </div>
        <a v-if="filtroServico.placa || filtroServico.entradaDe || filtroServico.entradaAte" href="#"
            class="pb-2 text-sm text-gray-500 underline" @click.prevent="limparFiltrosServico">Limpar filtros</a>
      </div>
      <ListaTrafego
          :trafegos="trafegos.servico.rows"
          :total="trafegos.servico.total"
          mostrarRegistrarSaida
          descricao="Veículos de serviço e visitantes autorizados que ainda não saíram"
          mensagemVazia="Nenhum veículo de serviço ou visitante no condomínio" />
      <Paginacao :page="trafegos.servico.page" :total="trafegos.servico.total || 0" @change="paginarServico" />
    </template>

    <HistoricoSaidas v-else-if="abaAtiva === 'historico'" />

    <ConciliacaoSaidas v-else-if="abaAtiva === 'conciliacao'" />
  </div>
</template>

<script>
import { computed, onMounted, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import debounce from 'lodash/debounce';

import useClientes from '../composables/useClientes';
import useTrafegos from '../composables/useTrafegos';
import useMoradores from '../composables/useMoradores';
import useSaidasNaoIdentificadas from '../composables/useSaidasNaoIdentificadas';

import ListaTrafego from './ListaTrafego.vue';
import HistoricoSaidas from './HistoricoSaidas.vue';
import ConciliacaoSaidas from './ConciliacaoSaidas.vue';
import Paginacao from './Paginacao.vue';

export default {
  components: { ListaTrafego, HistoricoSaidas, ConciliacaoSaidas, Paginacao },
  setup() {
    const route = useRoute();
    const router = useRouter();

    const trafegos = computed(() => useTrafegos.state.trafegos);
    const abaAtiva = computed(() => useTrafegos.state.trafegos.abaAtiva);

    const abas = computed(() => [
      { id: 'travessia', titulo: 'Em Travessia', contador: trafegos.value.lista.length },
      { id: 'servico', titulo: 'Em Serviço / Visitantes Autorizados', contador: trafegos.value.servico.total },
      { id: 'historico', titulo: 'Histórico de Saídas', contador: trafegos.value.historico.total },
      {
        id: 'conciliacao',
        titulo: 'Saídas sem Entrada Identificada',
        contador: abaAtiva.value === 'conciliacao' ? useSaidasNaoIdentificadas.state.saidas.total : null,
      },
    ]);

    const selecionar = (aba) => {
      router.replace({ query: { ...route.query, aba } });
    };

    // a aba ativa fica na URL: recarregar a página mantém a aba
    watch(
      () => route.query.aba,
      (aba) => {
        Promise.resolve(useTrafegos.actions.selecionarAba(aba || 'travessia')).catch((error) =>
          console.log('Erro carregando aba', error)
        );
      }
    );

    onMounted(async () => {
      try {
        await useTrafegos.actions.selecionarAba(route.query.aba || 'travessia');
      } catch (error) {
        console.log('Erro carregando aba', error);
      }

      if (useMoradores.state.moradores.lista.length == 0 && useClientes.state.clientes.selecionado) {
        useMoradores.actions.carregarMoradores(useClientes.state.clientes.selecionado.id);
      }
    });

    // ---------- filtros da Aba 2
    const filtroServico = reactive({ ...useTrafegos.state.trafegos.servico.filtros });
    watch(
      filtroServico,
      debounce((filtros) => {
        useTrafegos.actions.filtrarServico({ ...filtros });
      }, 400)
    );

    const limparFiltrosServico = () => {
      Object.assign(filtroServico, { placa: '', entradaDe: '', entradaAte: '' });
    };

    const paginarServico = (page) => {
      useTrafegos.actions.paginarServico(page);
    };

    return {
      abas,
      abaAtiva,
      trafegos,
      selecionar,
      filtroServico,
      limparFiltrosServico,
      paginarServico,
    };
  },
};
</script>
