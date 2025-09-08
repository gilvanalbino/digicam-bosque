<template>
  <Main titulo="Lista de Portarias" menu="Cadastro de Portarias">
    <template v-slot:buttons>
      <button type="button" @click="adicionar" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        Nova Portaria
      </button>
    </template>

    <div class="mt-5 flex flex-col">
      <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div v-if="portarias.length===0">Nenhuma portaria cadastrada</div>
          <div  v-if="portarias.length>0" class="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="portaria in portarias" :key="portaria.id">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                          {{ portaria.nome }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <router-link  :to="'/portarias/'+portaria.id" class="text-indigo-600 hover:text-indigo-900">Editar</router-link>
                    <a href="#" @click="remover(portaria.id)" class="text-indigo-600 hover:text-indigo-900 ml-5">Remover</a>
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

import { listarPortarias } from '../../database/dbPortarias';

import useClientes from '../../composables/useClientes'
import usePortarias from '../../composables/usePortarias';

export default {
  components: {Main},
  setup() {
    const router = useRouter();

    const adicionar = async () => {
      router.replace('/portarias/novo');
    }

    const remover = async(id)=>{
      const confirmaRemocao = confirm("Deseja realmente remover a portaria?");
      if (confirmaRemocao) {
        try {
          // remove o cliente
          console.log('Removendo portaria ', id)
          await usePortarias.actions.removerPortaria(id);
          notify({
            group: "success",
            title: "Sucesso",
            text: "Portaria removida com sucesso!"
          }, 4000)
        } catch (error) {
          console.log("ERRO removendo portaria", error);
          notify({
            group: "error",
            title: "Error",
            text: "Erro removendo portaria!"
          }, 4000)
        }
      }

    }

    const portarias = computed(()=>usePortarias.state.portarias.lista)

    onMounted(()=>{
      // faz um refresh da lista de clientes
      console.log("Recarregando clientes")
      usePortarias.actions.carregarPortarias(useClientes.state.clientes.selecionado.id);
    })

    return {
      portarias,
      adicionar,
      remover
    }
  },
}
</script>

<style>
</style>
