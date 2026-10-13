<template>
  <Main titulo="Green List" menu="Green List">
    <template v-slot:buttons>
      <input ref="campoArquivo" type="file" accept=".xlsx" class="hidden" @change="importar" />
      <button type="button" :disabled="importando" @click="escolherPlanilha" title="Planilha .xlsx com as colunas: Placa, Marca, Modelo, Nome, Endereço, Número, Complemento"
          class="mr-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
        {{ importando ? 'Importando…' : 'Importar planilha' }}
      </button>
      <button type="button" @click="adicionar" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        Novo Veículo
      </button>
    </template>

    <div v-if="resultado" class="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700" role="status">
      <div class="flex items-start justify-between gap-4">
        <p>
          <span class="font-medium text-gray-900">Importação concluída<template v-if="resultado.aba"> (aba "{{ resultado.aba }}", {{ resultado.linhas_lidas }} linha(s) lida(s))</template>:</span>
          {{ resultado.incluidos }} incluído(s), {{ resultado.atualizados }} atualizado(s), {{ resultado.inalterados }} sem alteração<template v-if="resultado.erros.length">, <span class="font-medium text-red-700">{{ resultado.erros.length }} linha(s) com erro</span></template>.
        </p>
        <button type="button" @click="resultado = null" class="text-indigo-600 hover:text-indigo-900">Fechar</button>
      </div>
      <ul v-if="resultado.erros.length" class="mt-2 max-h-48 overflow-y-auto list-disc pl-5 text-red-700">
        <li v-for="erro in resultado.erros" :key="erro.linha">Linha {{ erro.linha }}<template v-if="erro.placa"> ({{ erro.placa }})</template>: {{ erro.motivo }}</li>
      </ul>
    </div>
    <p class="mt-3 text-xs text-gray-500">Importação por planilha Excel (.xlsx), colunas nesta ordem: Placa, Marca, Modelo, Nome, Endereço, Número, Complemento. Placa já cadastrada tem os dados atualizados.</p>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <input type="text" v-model="texto" placeholder="Pesquisar por placa, nome, marca ou modelo" aria-label="Pesquisar por placa, nome, marca ou modelo"
        class="block w-full sm:w-96 shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
      <span v-if="carregado" class="text-sm text-gray-500">{{ total }} veículo(s)</span>
    </div>

    <div class="mt-3 flex flex-col">
      <div class="my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div v-if="carregado && whiteList.length===0">{{ texto.trim() ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado' }}</div>
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

    <Paginacao :page="page" :total="total" :pageSize="pageSize" @change="carregar" />

  </Main>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { notify } from "notiwind"

import Main from '../layout/Main.vue'
import Paginacao from '../../components/Paginacao.vue'

import { listarWhiteList, removerWhiteList, importarWhiteList } from '../../database/dbWhiteList';

import useClientes from '../../composables/useClientes'
import useLogin from '../../composables/useLogin';

export default {
  components: {Main, Paginacao},
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
          // se a página ficou vazia depois da remoção, volta uma
          await carregar(whiteList.value.length === 1 && page.value > 1 ? page.value - 1 : page.value);
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
        const resposta = await listarWhiteList(useLogin.state.auth.token, useClientes.state.clientes.selecionado.id, {
          texto: texto.value.trim(),
          page: pagina,
          pageSize,
        });
        if (meuPedido !== pedido) return;
        whiteList.value = resposta.rows || [];
        total.value = resposta.total || 0;
        page.value = resposta.page || pagina;
        carregado.value = true;
      } catch (error) {
        console.log("ERRO carregando a green list", error);
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

    const campoArquivo = ref(null);
    const importando = ref(false);
    const resultado = ref(null);
    const escolherPlanilha = () => campoArquivo.value.click();
    const importar = async (evento) => {
      const arquivo = evento.target.files[0];
      // permite escolher o mesmo arquivo de novo depois de corrigi-lo
      evento.target.value = '';
      if (!arquivo) return;
      importando.value = true;
      resultado.value = null;
      try {
        const resposta = await importarWhiteList(useLogin.state.auth.token, useClientes.state.clientes.selecionado.id, arquivo);
        if (!resposta || !Array.isArray(resposta.erros)) {
          throw Error((resposta && resposta.message) || 'Resposta inesperada');
        }
        resultado.value = resposta;
        await carregar(1);
      } catch (error) {
        console.log("ERRO importando planilha", error);
        const detalhe = error.response && error.response.data && error.response.data.message;
        notify({
          group: "error",
          title: "Error",
          text: detalhe || error.message || "Erro importando a planilha!"
        }, 15000)
      } finally {
        importando.value = false;
      }
    }

    onMounted(() => carregar(1))

    return {
      whiteList,
      texto,
      page,
      pageSize,
      total,
      carregado,
      carregar,
      campoArquivo,
      importando,
      resultado,
      escolherPlanilha,
      importar,
      adicionar,
      remover
    }
  },
}
</script>

<style>
</style>
