<template>
  <Main titulo="Red List" menu="Red List">
    <template v-slot:buttons>
      <button type="button" @click="adicionar" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        Novo Veículo
      </button>
    </template>

    <div class="mt-5 flex flex-wrap items-center gap-3">
      <input type="text" v-model="texto" placeholder="Pesquisar por placa, motivo, marca ou modelo" aria-label="Pesquisar por placa, motivo, marca ou modelo"
        class="block w-full sm:w-96 shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
      <span v-if="carregado" class="text-sm text-gray-500">{{ total }} veículo(s)</span>
    </div>

    <div class="mt-3 flex flex-col">
      <div class="my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div v-if="carregado && blackList.length===0">{{ texto.trim() ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado' }}</div>
          <div  v-if="blackList.length>0" class="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
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
                    Motivo
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="veiculo in blackList" :key="veiculo.id">
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
                          {{ veiculo.motivo }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <router-link  :to="'/redList/'+veiculo.id" class="text-indigo-600 hover:text-indigo-900">Editar</router-link>
                    <a href="#" @click="remover(veiculo.id)" class="text-indigo-600 hover:text-indigo-900 ml-5">Remover</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <Paginacao :page="page" :total="total" :pageSize="pageSize" @change="carregar" />

  </Main>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { notify } from "notiwind"

import Main from '../layout/Main.vue'
import Paginacao from '../../components/Paginacao.vue'

import { listarBlackList, removerBlackList } from '../../database/dbBlackList';

import useClientes from '../../composables/useClientes'
import useLogin from '../../composables/useLogin';

export default {
  components: {Main, Paginacao},
  setup() {
    const router = useRouter();

    const adicionar = async () => {
      router.replace('/redList/novo');
    }

    const remover = async(id)=>{
      const confirmaRemocao = confirm("Deseja realmente remover o veículo da red list?");
      if (confirmaRemocao) {
        try {
          console.log('Removendo veículo da red list ', id)
          await removerBlackList(useLogin.state.auth.token, id)
          notify({
            group: "success",
            title: "Sucesso",
            text: "Veículo removido com sucesso!"
          }, 4000)
          // se a página ficou vazia depois da remoção, volta uma
          await carregar(blackList.value.length === 1 && page.value > 1 ? page.value - 1 : page.value);
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

    const blackList = ref([]);
    const texto = ref('');
    const page = ref(1);
    const pageSize = 50;
    const total = ref(0);
    const carregado = ref(false);

    // a resposta de uma pesquisa antiga não pode sobrescrever a de uma mais nova
    let pedido = 0;
    const carregar = async (pagina = 1) => {
      const meuPedido = ++pedido;
      try {
        const resposta = await listarBlackList(useLogin.state.auth.token, useClientes.state.clientes.selecionado.id, {
          texto: texto.value.trim(),
          page: pagina,
          pageSize,
        });
        if (meuPedido !== pedido) return;
        blackList.value = resposta.rows || [];
        total.value = resposta.total || 0;
        page.value = resposta.page || pagina;
        carregado.value = true;
      } catch (error) {
        console.log("ERRO carregando a red list", error);
        notify({
          group: "error",
          title: "Error",
          text: "Erro carregando a lista!"
        }, 4000)
      }
    }

    // pesquisa enquanto digita, com uma pequena espera
    let espera = null;
    watch(texto, () => {
      clearTimeout(espera);
      espera = setTimeout(() => carregar(1), 300);
    });
    onBeforeUnmount(() => clearTimeout(espera));

    onMounted(() => carregar(1))

    return {
      blackList,
      texto,
      page,
      pageSize,
      total,
      carregado,
      carregar,
      adicionar,
      remover
    }
  },
}
</script>

<style>
</style>
