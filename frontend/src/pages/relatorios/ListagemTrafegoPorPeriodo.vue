<template>
  <ModalDialog :show="showModal">
    <div v-if="tipoImagem==='E'">
      <img :src="`/images${trafegoSelecionado.imagem}`" />
      <img v-if="trafegoSelecionado.imagem_placa" :src="`/images${trafegoSelecionado.imagem_placa}`" />
    </div>
    <div v-if="tipoImagem==='S'">
      <img :src="`/images${trafegoSelecionado.imagem_saida}`" />
      <img v-if="trafegoSelecionado.imagem_placa" :src="`/images${trafegoSelecionado.imagem_placa}`" />
    </div>
  </ModalDialog>
  <Main titulo="Listagem de tráfego por período" menu="Rel. Listagem Trafego">
    <div>
      <div class="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-12">
        <div class="sm:col-span-3">
          <div class="mt-1">
            <Datepicker v-model="dataHoraInicio" placeholder="Data/hora inicial" locale="pt-BR" :format-locale="ptBR" :format="format" selectText="Selecionar" cancelText="Cancelar"></Datepicker>
            <p v-if="mapErro.dataHoraInicio" class="text-red-500">{{mapErro.dataHoraInicio}}</p>
          </div>
        </div>

        <div class="sm:col-span-3">
          <div class="mt-1">
            <Datepicker v-model="dataHoraFim" placeholder="Data/hora final" locale="pt-BR" :format-locale="ptBR" :format="format" selectText="Selecionar" cancelText="Cancelar"></Datepicker>
            <p v-if="mapErro.dataHoraFim" class="text-red-500">{{mapErro.dataHoraFim}}</p>
          </div>
        </div>

        <div class="sm:col-span-2">
          <div class="mt-1">
            <select id="portaria_entrada_id" name="portaria_entrada_id" v-model="portaria_entrada_id" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
              <option :value="null">Fitrar Entrada</option>
              <option v-for="portaria in portarias" :key="portaria" :value="portaria.id">{{ portaria.nome }}</option>
            </select>
          </div>
        </div>

        <div class="sm:col-span-2">
          <div class="mt-1">
            <select id="portaria_saida_id" name="portaria_saida_id" v-model="portaria_saida_id"
              class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
              <option :value="null">Filtrar Saídas</option>
              <option v-for="portaria in portarias" :key="portaria" :value="portaria.id">{{ portaria.nome }}</option>
            </select>
          </div>
        </div>

        <div class="sm:col-span-1">
          <div class="mt-1">
            <input type="text" v-model="texto_placa_nome" placeholder="Placa" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md">
          </div>
        </div>

        <div class="sm:col-span-1">
          <button type="button" @click="pesquisar" class="mt-1 inline-flex justify-center py-2 px-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Pesquisar
          </button>
        </div>
      </div>
      <p class="font-medium mt-1 text-sm text-indigo-600">
        <a href="#" v-if="realizouPesquisa" @click="downloadExcel" >
          Download
        </a>
      </p>
    </div>

    <div v-if="realizouPesquisa" class="mt-2 mb-2">
      {{ trafegos.length }} registros
    </div>

    <!-- Listagem -->
    <div class="mt-5 flex flex-col">
      <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div v-if="trafegos.length>0" class="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-200 table-fixed">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Placa
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Green List
                  </th>
                  <th scope="col" class="whitespace-nowrap px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Imagem Entrada
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entrada
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destino
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Observação
                  </th>
                  <th scope="col" class="whitespace-nowrap px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Imagem Saída
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saída
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="trafego in trafegos" :key="trafego.id">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ trafego.placa }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ trafego.in_whitelist ? "Sim": "" }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center" @click="visualizarImagem(trafego, 'E')">
                      <img class="w-20 rounded-lg " :src="`/images${trafego.imagem_thumb}`" alt="" />
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ mapPortarias[trafego.portaria_entrada_id].nome }}
                      </div>
                    </div>
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ formatarData(trafego.dataEntrada) }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ trafego.nome }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ mapDestinos[trafego.destino] }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ trafego.observacao }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div v-if="trafego.dataSaida!==null" class="flex items-center" @click="visualizarImagem(trafego, 'S')">
                      <img class="w-20 rounded-lg " :src="`/images${trafego.imagem_saida_thumb}`" alt="" />
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ trafego.portaria_saida_id ? mapPortarias[trafego.portaria_saida_id].nome : "" }}
                      </div>
                    </div>
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ formatarData(trafego.dataSaida) }}
                      </div>
                    </div>
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
import { computed, onMounted, ref, toRaw, toRef } from 'vue';
import { ptBR } from 'date-fns/locale'
import _ from 'lodash'
import { notify } from "notiwind"

import Main from '../layout/Main.vue'

import { listagemTrafegos, listagemTrafegosExcel } from '../../database/dbRelatorios'

import useLogin from '../../composables/useLogin';
import useClientes from '../../composables/useClientes';
import usePortarias from '../../composables/usePortarias';

import { formatarData, beginOfDay, endOfDay } from '../../utils/dateUtil';

import ModalDialog from '../../components/ModalDialog.vue';

const mapDestinos = {
  "morador": "Casa Morador",
  "cruzar": "Cruzar Condomínio",
  "servico": "Serviço"
}


export default {
  components: {Main, ModalDialog},
  setup() {
    const dataHoraInicio = ref(beginOfDay(new Date()));
    const dataHoraFim = ref(endOfDay(new Date()));
    const portaria_entrada_id = ref(null);
    const portaria_saida_id = ref(null);
    const texto_placa_nome = ref("");

    const mapErro = ref({});
    const realizouPesquisa = ref(false)

    const trafegos = ref([])

    const portarias = computed(()=>usePortarias.state.portarias.lista)

    const mapPortarias = computed(()=>usePortarias.state.portarias.map)

    const format = (date) => {
        const day = _.padStart(`${date.getDate()}`,2,"0");
        const month = _.padStart(`${date.getMonth() + 1}`,2,"0");
        const year = _.padStart(`${date.getFullYear()}`,2,"0");

        const hour = _.padStart(`${date.getHours()}`,2,"0");
        const min = _.padStart(`${date.getMinutes()}`,2,"0");

        return `${day}/${month}/${year} ${hour}:${min}`;
    }

    const pesquisar = async () => {
      if (!validar(dataHoraInicio, dataHoraFim, mapErro)) {
        try {
          console.log("Realizando pesquisa!")
          trafegos.value =
            await listagemTrafegos(
              useLogin.state.auth.token,
              useClientes.state.clientes.selecionado.id,
              dataHoraInicio.value,
              dataHoraFim.value,
              portaria_entrada_id.value,
              portaria_saida_id.value,
              texto_placa_nome.value);
          realizouPesquisa.value = true;
        } catch (error) {
          console.log(error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro executando pesquisa!"
          }, 4000)
        }
      }
    }

    const downloadExcel = async () => {
      if (!validar(dataHoraInicio, dataHoraFim, mapErro)) {
        try {
          console.log("Realizando download excel!")
          await listagemTrafegosExcel(
            useLogin.state.auth.token,
            useClientes.state.clientes.selecionado.id,
            dataHoraInicio.value,
            dataHoraFim.value,
            portaria_entrada_id.value,
            portaria_saida_id.value,
            texto_placa_nome.value);
        } catch (error) {
          console.log(error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro executando pesquisa!"
          }, 4000)
        }
      }
    }

    const showModal = ref(false);
    const trafegoSelecionado = ref({})
    const tipoImagem = ref({})
    const visualizarImagem = (trafego, tipo) => {
      trafegoSelecionado.value = trafego;
      tipoImagem.value = tipo;
      showModal.value = false
      setTimeout(()=>{
        showModal.value = true
      }, 100)

    }

    onMounted(async () => {
      pesquisar();
    });

    return {
      dataHoraInicio,
      dataHoraFim,
      portaria_entrada_id,
      portaria_saida_id,
      texto_placa_nome,
      format,
      pesquisar,
      downloadExcel,
      mapErro,
      ptBR,
      trafegos,
      portarias,
      mapPortarias,
      formatarData,
      mapDestinos,
      realizouPesquisa,
      showModal,
      trafegoSelecionado,
      visualizarImagem,
      tipoImagem
    }
  },
}

const validar = (dataHoraInicio, dataHoraFim, mapErro) => {
  let erro=false;
  // dataHoraInicio
  if (!(dataHoraInicio.value instanceof Date)) {
    mapErro.value.dataHoraInicio = "Informe a data início"
    erro = true;
  } else {
    mapErro.value.dataHoraInicio = ""
  }

  // dataHoraFim
  if (!(dataHoraFim.value instanceof Date)) {
    mapErro.value.dataHoraFim = "Informa a data final"
    erro = true;
  } else {
    mapErro.value.dataHoraFim = ""
  }

  return erro;
}

</script>

<style>
</style>
