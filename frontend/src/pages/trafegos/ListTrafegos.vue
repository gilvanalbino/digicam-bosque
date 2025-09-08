<template>
  <ModalDialog :show="showModal">
    <img :src="`/images${imagemSelecionada}`" />
    <img v-if="imagemSelecionadaPlaca" :src="`/images${imagemSelecionadaPlaca}`" />
  </ModalDialog>
  <Main :titulo="titulo" menu="Tráfego">
    <template v-slot:buttons v-if="portariaSelecionada">
        <button type="button" @click="adicionarIdentAutomatica" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mr-3">
          Identificação Automática
        </button>
        <button type="button" @click="adicionar" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          Identificação Manual
        </button>
    </template>
    <div v-if="trafegos.length===0">Nenhuma trafego cadastrado</div>

    <!-- Lista de Trafegos -->
    <div v-else class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div v-for="trafego in trafegos" :key="trafego.id"
          class="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
          @click="visualizarImagem(trafego.imagem, trafego.imagem_placa)">
        <div class="flex-shrink-0">
          <img class="h-20 w-20" :src="`/images${trafego.imagem_thumb}`" alt="" />
        </div>
        <div class="flex-1 min-w-0">
          <a href="#" class="focus:outline-none">
            <span class="absolute inset-0" aria-hidden="true" />
            <p>
              <span class="text-lg font-bold text-gray-900 mr-2">
              {{ trafego.placa }}
              </span>
              <span v-if="trafego.nome" class="text-base font-bold text-gray-400">
                {{ trafego.nome }}
              </span>
            </p>
            <p class="text-sm text-green-500 font-bold truncate">
              {{ formatarData(trafego.dataEntrada) }} {{ trafego.permanencia }}
            </p>
            <div v-if="trafego.morador_id">
              <p v-if="trafego.destino=='morador'" class="text-sm text-green-600 font-bold truncate">
                Morador: {{ mapMoradores[trafego.morador_destino_id].nome }} {{ mapMoradores[trafego.morador_destino_id].endereco }}
              </p>
            </div>
            <p v-if="trafego.destino=='cruzar'" class="text-sm text-red-600 font-bold truncate">
              Cruzar condomínio
            </p>
            <p v-if="trafego.destino=='servico'" class="text-sm text-blue-600 font-bold truncate">
              Serviço
            </p>
            <p class="text-sm text-gray-400 italic">
              {{ trafego.observacao }}
            </p>
          </a>
        </div>
      </div>
    </div>
  </Main>
</template>

<script>
import { ref, onMounted, computed, toRaw } from 'vue';
import { useRouter } from 'vue-router';
import { notify } from "notiwind"

import Main from '../layout/Main.vue'

import useClientes from '../../composables/useClientes';
import usePortarias from '../../composables/usePortarias'
import useTrafegos from '../../composables/useTrafegos';
import useMoradores from '../../composables/useMoradores'

import { formatarData } from '../../utils/dateUtil';

import ModalDialog from '../../components/ModalDialog.vue';

export default {
  components: {Main, ModalDialog},
  setup() {

    const portariaSelecionada = computed(() => usePortarias.state.portarias.selecionada);

    const trafegos = computed(() => {
      console.log("trafegos: ", toRaw(useTrafegos.state.trafegos.lista))
      return useTrafegos.state.trafegos.lista.filter((t)=>t.portaria_entrada_id == usePortarias.state.portarias.selecionada.id)
    })


    const titulo = computed(()=>{
      if (usePortarias.state.portarias.selecionada) {
        return `Entrada de Veículo - Portaria ${usePortarias.state.portarias.selecionada.nome}`
      } else {
        return "Selecione uma portaria";
      }
    })

    const mapMoradores = computed(()=>useMoradores.state.moradores.map)

    onMounted(()=>{
      // faz um refresh da lista de clientes
      console.log("Recarregando trafegos")
      useTrafegos.actions.carregarTrafegos(useClientes.state.clientes.selecionado.id);

      if (useMoradores.state.moradores.lista.length==0) {
        useMoradores.actions.carregarMoradores(useClientes.state.clientes.selecionado.id)
      }
    })

    const router = useRouter();

    const adicionar = () => {
      router.replace('/trafegos/novo');
    }

    const adicionarIdentAutomatica = () => {
      router.replace('/trafegos/placasIdentificadas');
    }

    const imagemSelecionada = ref("")
    const imagemSelecionadaPlaca = ref("")
    const visualizarImagem = (imagem, imagemPlaca) => {
      console.log("Chamando VisualizarImagem():", imagem)
      imagemSelecionada.value = imagem
      imagemSelecionadaPlaca.value = imagemPlaca
      showModal.value = false
      setTimeout(()=>{
        showModal.value = true
      }, 100)

    }

    const showModal = ref(false);

    return {
      titulo,
      portariaSelecionada,
      formatarData,
      trafegos,
      adicionar,
      adicionarIdentAutomatica,
      mapMoradores,
      showModal,
      imagemSelecionada,
      imagemSelecionadaPlaca,
      visualizarImagem
    }
  },
}
</script>

<style>
</style>
