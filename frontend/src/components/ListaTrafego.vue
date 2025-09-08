<template>
  <ModalDialog :show="showModal">
    <img :src="`/images${trafegoSelecionado.imagem}`" />
    <img v-if="trafegoSelecionado.imagem_placa" :src="`/images${trafegoSelecionado.imagem_placa}`" />
    <a href="#" @click="saidaManual(trafegoSelecionado.id)" class="mt-5 inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
      Registrar saída manual
    </a>
    <a href="#" @click="editarTrafego(trafegoSelecionado.id)" class="ml-2 mt-5 inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
      Editar
    </a>
  </ModalDialog>
  <h3 class="text-sm leading-4 italic font-medium text-gray-500">
    Entradas registradas - veículos que entraram e não saíram (total: {{trafegos.length}})
  </h3>

  <div v-if="trafegos.length===0" class="mb-32 mt-2 text-sky-500">Nenhuma entrada de veículo cadastrada</div>

  <div v-else class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
    <div v-for="trafego in trafegos" :key="trafego.id"
        class="relative rounded-lg border border-gray-300 bg-white px-2 py-2 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
        :class="(trafego.permanencia > '00:03:00' && trafego.destino==='cruzar' && !trafego.in_whitelist) ? 'alarm': (trafego.in_whitelist ? 'white-list' : (trafego.in_blacklist ? 'black-list' : ''))"
        @click="visualizarImagem(trafego)">
      <div class="flex-shrink-0">
        <img class="h-20 w-20 rounded-lg " :src="`/images${trafego.imagem_thumb}`" alt="" />
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
          <p class="text-xs text-green-700 font-bold truncate">
            Entrada: {{mapPortaria[trafego.portaria_entrada_id].nome}}
          </p>
          <p class="text-xs text-green-700  truncate">
            {{ formatarData(trafego.dataEntrada) }}
          </p>
          <p class="text-xs text-green-700  truncate">
            Permanência: {{ trafego.permanencia }}
          </p>
          <p v-if="trafego.destino=='morador' && trafego.morador_id!=null" class="text-xs text-green-500 font-bold truncate">
            Morador: {{ mapMoradores[trafego.morador_destino_id].nome }} {{ mapMoradores[trafego.morador_destino_id].endereco }}
          </p>
          <p v-if="trafego.destino=='cruzar'" class="text-xs text-red-500 font-bold truncate">
            Cruzar condomínio
          </p>
          <p v-if="trafego.destino=='servico'" class="text-xs text-blue-500 font-bold truncate">
            Serviço
          </p>
          <p class="text-sm text-gray-400 italic">
            {{ trafego.observacao }}
          </p>
        </a>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, toRaw, toRefs } from 'vue';
import { notify } from "notiwind"

import { useRouter } from 'vue-router';

import useClientes from '../composables/useClientes';
import usePortarias from '../composables/usePortarias'
import useTrafegos from '../composables/useTrafegos';
import useMoradores from '../composables/useMoradores'

import { formatarData } from '../utils/dateUtil';

import ModalDialog from '../components/ModalDialog.vue';

export default {
  components: {ModalDialog},
  setup() {

    const router = useRouter();

    const trafegos = computed(() => {
      return useTrafegos.state.trafegos.lista;
    })

    const mapMoradores = computed(()=>useMoradores.state.moradores.map)

    const mapPortaria = computed(()=>usePortarias.state.portarias.map)

    onMounted(async ()=>{
      if (!useClientes.state.clientes.selecionado.id) {
        setTimeout(()=>{
          console.log("Aguardando selecionar o cliente")
        },1000)
      }

      // faz um refresh da lista de clientes
      await useTrafegos.actions.carregarTrafegos(useClientes.state.clientes.selecionado.id);

      if (useMoradores.state.moradores.lista.length==0) {
        useMoradores.actions.carregarMoradores(useClientes.state.clientes.selecionado.id)
      }
    })

    const trafegoSelecionado = ref({})
    const visualizarImagem = (trafego) => {
      trafegoSelecionado.value = trafego;
      showModal.value = false
      setTimeout(()=>{
        showModal.value = true
      }, 100)
    }

    const showModal = ref(false);

    const saidaManual = async (id) => {
      const confirma = confirm("Deseja realmente registrar saída deste veículo?");
      if (confirma) {
        showModal.value = !showModal.value;
        try {
          await useTrafegos.actions.registrarSaidaManual(id, usePortarias.state.portarias.selecionada.id);
        } catch(error){
          notify({
            group: "error",
            title: "Error",
            text: "Erro registrando saída do veículo!"
          }, 4000)
        }
      }
    }

    const editarTrafego = (id) => {
      router.replace(`/trafegos/editar/${id}`)
    }

    return {
      formatarData,
      trafegos,
      mapMoradores,
      mapPortaria,
      showModal,
      trafegoSelecionado,
      visualizarImagem,
      saidaManual,
      editarTrafego
    }
  },
}
</script>

<style>
  .alarm {
    -webkit-animation: ALERT-ANIMATION 1s infinite; /* Safari 4+ */
    -moz-animation:    ALERT-ANIMATION 1s infinite; /* Fx 5+ */
    -o-animation:      ALERT-ANIMATION 1s infinite; /* Opera 12+ */
    animation:         ALERT-ANIMATION 1s infinite; /* IE 10+, Fx 29+ */
  }

  @-webkit-keyframes ALERT-ANIMATION {
    0%, 49% {
        background-color: white;
    }
    50%, 100% {
        background-color: #ffadad;
    }
  }

  .white-list {
    background-color: rgb(200, 246, 200);
  }

  .black-list {
    background-color: rgb(255, 4, 0);
  }

  .black-list .text-green-700 {
    color: white;
  }

  .black-list .text-gray-400 {
    color: white;
  }

</style>
