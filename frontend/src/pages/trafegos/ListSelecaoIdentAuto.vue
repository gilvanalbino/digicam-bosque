<template>
  <Main :titulo="titulo" menu="Tráfego">
    <div class="mt-5 flex flex-col">
      <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div v-if="logIdentificacaoList.length===0">Nenhum placa identificada</div>
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
                <tr v-for="logIdentificacao in logIdentificacaoList" :key="logIdentificacao.id">
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
import { ref, onMounted, computed, toRaw } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { notify } from "notiwind"

import Main from '../layout/Main.vue'

import useCameras from '../../composables/useCameras';
import useLogIdentificacao from '../../composables/useLogIdentificacao';
import usePortarias from '../../composables/usePortarias'
import useLogin from '../../composables/useLogin';
import useClientes from '../../composables/useClientes';

import { formatarData } from '../../utils/dateUtil';

export default {
  components: { Main },
  setup() {
    const titulo = computed(()=>{
      if (usePortarias.state.portarias.selecionada) {
        return `Identificação Automática - Portaria ${usePortarias.state.portarias.selecionada.nome}`
      } else {
        return "Selecione uma portaria";
      }
    })

    const portariaSelecionada = computed(() => usePortarias.state.portarias.selecionada)
    const logIdentificacaoList = computed(() => useLogIdentificacao.state.identificacoes.lista)

    onMounted(async () => {
      await useCameras.actions.carregarCameras(useClientes.state.clientes.selecionado.id)
      const camera = useCameras.actions.getCameraEntrada(usePortarias.state.portarias.selecionada.id)
      if (camera) {
        await useLogIdentificacao.actions.carregarIdentificacoes(camera.id)
      } else {
        console.log("Nenhuma camera de entrada registra na entrada")
      }
    });

    const remover = async(id)=>{
      const confirmaRemocao = confirm("Deseja realmente remover a identificação de placa?");
      if (confirmaRemocao) {
        try {
          // remove o cliente
          console.log('Removendo portaria ', id)
          await useLogIdentificacao.actions.removerIdentificacao(id);
          notify({
            group: "success",
            title: "Sucesso",
            text: "Identificação removida com sucesso!"
          }, 4000)
        } catch (error) {
          console.log("ERRO removendo identificação", error);
          notify({
            group: "error",
            title: "Error",
            text: "Erro removendo identificação!"
          }, 4000)
        }
      }
    }

    return {
      titulo,
      portariaSelecionada,
      logIdentificacaoList,
      remover,
      formatarData
    }
  },
}
</script>

<style>
</style>
