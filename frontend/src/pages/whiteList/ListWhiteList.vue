<template>
  <Main titulo="Green List" menu="Green List">
    <template v-slot:buttons>
      <button type="button" @click="adicionar" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        Novo Veículo
      </button>
    </template>

    <div class="mt-5 flex flex-col">
      <div class="my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div v-if="whiteList.length===0">Nenhum veículo cadastrado</div>
          <div  v-if="whiteList.length>0" class="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Placa
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Marca / Modelo
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endereço
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="veiculo in whiteList" :key="veiculo.id">
                  <td class="px-2 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                          {{ veiculo.placa }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                          {{ veiculo.marca }} - {{ veiculo.modelo }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                          {{ veiculo.nome }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                          {{ veiculo.endereco }} {{ veiculo.numero }} {{ veiculo.complemento }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <router-link  :to="'/greenList/'+veiculo.id" class="text-indigo-600 hover:text-indigo-900">Editar</router-link>
                    <a href="#" @click="remover(veiculo.id)" class="text-indigo-600 hover:text-indigo-900 ml-5">Remover</a>
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
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { notify } from "notiwind"

import Main from '../layout/Main.vue'

import { listarWhiteList, removerWhiteList } from '../../database/dbWhiteList';

import useClientes from '../../composables/useClientes'
import useLogin from '../../composables/useLogin';

export default {
  components: {Main},
  setup() {
    const router = useRouter();

    const adicionar = async () => {
      router.replace('/greenList/novo');
    }

    const remover = async(id)=>{
      const confirmaRemocao = confirm("Deseja realmente remover o veículo da green list?");
      if (confirmaRemocao) {
        try {
          console.log('Removendo veículo da green list ', id)
          await removerWhiteList(useLogin.state.auth.token, id)
          notify({
            group: "success",
            title: "Sucesso",
            text: "Veículo removido com sucesso!"
          }, 4000)
          whiteList.value = await listarWhiteList(useLogin.state.auth.token, useClientes.state.clientes.selecionado.id);
        } catch (error) {
          console.log("ERRO removendp veículo", error);
          notify({
            group: "error",
            title: "Error",
            text: "Erro removendo veículo!"
          }, 4000)
        }
      }

    }

    const whiteList = ref([]);

    onMounted(async ()=>{
      const wl = await listarWhiteList(useLogin.state.auth.token, useClientes.state.clientes.selecionado.id);
      console.log("WhiteList = ", wl)
      whiteList.value = wl;
      if (!whiteList.value) {
        whiteList.value = []
      }
    })

    return {
      whiteList,
      adicionar,
      remover
    }
  },
}
</script>

<style>
</style>
