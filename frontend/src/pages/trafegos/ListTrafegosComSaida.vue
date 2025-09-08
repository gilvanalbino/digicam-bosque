<template>
  <Main :titulo="titulo" menu="Tráfego/Saídas">
    <div class="mt-5 flex flex-col">
      <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div v-if="trafegos.length===0">Nenhum registro cadastrado</div>
          <div v-else class="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <!-- <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Imagem Carro
                  </th> -->
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Imagem Placa
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Placa
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sentido
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="logIdentificacao in trafegos" :key="logIdentificacao.id">
                  <!-- <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <img class="h-20 w-20" :src="logIdentificacao.imagem_carro" alt="" />
                    </div>
                  </td> -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <img class="h-20 w-20" :src="logIdentificacao.imagem_placa" alt="" />
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">{{ logIdentificacao.placa }} </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">
                        {{ formatarData(logIdentificacao.data) }}
                      </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">
                        {{ logIdentificacao.sentido }}
                      </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <!-- <router-link v-if="logIdentificacao.sentido!=='reverse'"  :to="'/trafegos/novo/placaIdentificada/'+logIdentificacao.id" class="text-indigo-600 hover:text-indigo-900">Registrar Entrada</router-link> -->
                    <router-link :to="'/trafegos/novo/placaIdentificada/'+logIdentificacao.id" class="text-indigo-600 hover:text-indigo-900">Registrar Entrada</router-link>
                    <a href="#" @click="remover(logIdentificacao.id)" class="text-indigo-600 hover:text-indigo-900 ml-5">Descartar</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </Main>
</template>

<script>
import { onMounted, computed } from 'vue';

import Main from '../layout/Main.vue'

import useClientes from '../../composables/useClientes';

import { formatarData } from '../../utils/dateUtil';
import useTrafegos from '../../composables/useTrafegos';

export default {
  components: { Main },
  setup() {
    const titulo = computed(()=>{
      return "Últimas Entradas/Saídas";
    })

    const trafegos = computed(() => useTrafegos.state.trafetos.listaComSaida)

    onMounted(async () => {
      await useTrafegos.actions.carregarTrafegos(useClientes.state.clientes.selecionado.id)
    });

    return {
      titulo,
      trafegos,
      formatarData
    }
  },
}
</script>

<style>
</style>
