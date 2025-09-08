<template>
  <Main titulo="Lista de Clientes" menu="Cadastro de Clientes">
    <template v-slot:buttons>
      <button type="button" @click="adicionar" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        Novo Cliente
      </button>
    </template>

    <div class="mt-5 flex flex-col">
      <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div v-if="clientes.length===0">Nenhum cliente cadastrado</div>
          <div v-if="clientes.length>0" class="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endereço
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ativo
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entrada Automática
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alarme
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="cliente in clientes" :key="cliente.id">
                  <td class="py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                          {{ cliente.name }}
                        </div>
                        <div class="text-sm text-gray-500">
                          {{ cliente.cpfCnpj }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">{{ cliente.address }}, {{ cliente.number }}  </div>
                    <div class="text-sm text-gray-500">{{ cliente.district }}, {{ cliente.city }}, {{ cliente.state }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span v-if="cliente.active" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Ativo
                    </span>
                    <span v-if="!cliente.active" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-200 text-red-800">
                      Inativo
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span v-if="cliente.entrada_automatica" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Sim
                    </span>
                    <span v-if="!cliente.entrada_automatica" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-200 text-red-800">
                      Não
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span v-if="cliente.tocar_alarme" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Sim
                    </span>
                    <span v-if="!cliente.tocar_alarme" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-200 text-red-800">
                      Não
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <router-link  :to="'/clientes/'+cliente.id" class="text-indigo-600 hover:text-indigo-900">Editar</router-link>
                    <a href="#" @click="remover(cliente.id)" class="text-indigo-600 hover:text-indigo-900 ml-5">Remover</a>
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
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { notify } from "notiwind"

import Main from '../layout/Main.vue'

import useClientes from '../../composables/useClientes'

export default {
  components: {Main},
  setup() {
    const router = useRouter();

    const adicionar = async () => {
      router.replace('/clientes/novo');
    }

    // referencia para a lista de clientes
    const clientes = computed(() => useClientes.state.clientes.lista)

    onMounted(()=>{
      // faz um refresh da lista de clientes
      console.log("Recarregando clientes")
      useClientes.actions.carregarClientes();
    })

    const remover = async (id) => {
      const confirmaRemocao = confirm("Deseja realmente remover o cliente?");
      if (confirmaRemocao) {
        try {
          // remove o cliente
          await useClientes.actions.removerCliente(id);
          notify({
            group: "success",
            title: "Sucesso",
            text: "Cliente removido com sucesso!"
          }, 4000)
        } catch (error) {
          console.log("ERRO removendo cliente", error);
          notify({
            group: "error",
            title: "Error",
            text: "Erro removendo cliente!"
          }, 4000)
        }
      }
    }

    return {
      clientes,
      adicionar,
      remover
    }
  },
}
</script>

<style>
</style>
