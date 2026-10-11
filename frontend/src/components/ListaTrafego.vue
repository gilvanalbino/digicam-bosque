<template>
  <ModalDialog :show="showModal">
    <img :src="`/images${trafegoSelecionado.imagem}`" />
    <img v-if="trafegoSelecionado.imagem_placa" :src="`/images${trafegoSelecionado.imagem_placa}`" />
    <a href="#" @click.prevent="saidaManual(trafegoSelecionado)" class="mt-5 inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
      Registrar saída manual
    </a>
    <a href="#" @click.prevent="editarTrafego(trafegoSelecionado.id)" class="ml-2 mt-5 inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
      Editar
    </a>
  </ModalDialog>
  <h3 class="text-sm leading-4 italic font-medium text-gray-500">
    {{ descricao }} (total: {{ total === null ? trafegos.length : total }})
  </h3>

  <div v-if="trafegos.length===0" class="mb-32 mt-2 text-sky-500">{{ mensagemVazia }}</div>

  <div v-else class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
    <div v-for="trafego in trafegos" :key="trafego.id"
        :class="entradaPosteriorASaida(trafego) ? 'opacity-40' : ''"
        :title="entradaPosteriorASaida(trafego) ? 'Entrada posterior à saída: não pode ser associada' : null"
        draggable="true"
        class="cursor-grab"
        @dragstart="iniciarArrasteEntrada($event, trafego)"
        @dragend="finalizarArrasteEntrada"
        @dragover="permitirSoltar($event, trafego)"
        @dragleave="sairDoAlvo(trafego)"
        @drop.prevent="soltar(trafego)">
      <TrafegoCard class="h-full"
          :trafego="trafego"
          :mapPortaria="mapPortaria"
          :mapMoradores="mapMoradores"
          :mostrarRegistrarSaida="mostrarRegistrarSaida"
          :destacado="alvoId === trafego.id"
          :saidaParaAssociar="podeAssociar(trafego, saidaSelecionada) ? saidaSelecionada : null"
          :placaParecida="placaParecida(trafego)"
          @abrir="visualizarImagem"
          @registrarSaida="saidaManual"
          @associarSaida="associarSaida" />
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { notify } from "notiwind"

import { useRouter } from 'vue-router';

import usePortarias from '../composables/usePortarias'
import useTrafegos from '../composables/useTrafegos';
import useMoradores from '../composables/useMoradores'
import useSaidasNaoIdentificadas, { podeAssociar } from '../composables/useSaidasNaoIdentificadas';

import { diferencasPlacas } from '../utils/placaUtil';

import ModalDialog from '../components/ModalDialog.vue';
import TrafegoCard from '../components/TrafegoCard.vue';

export default {
  components: {ModalDialog, TrafegoCard},
  props: {
    trafegos: { type: Array, required: true },
    descricao: { type: String, required: true },
    mensagemVazia: { type: String, default: 'Nenhuma entrada de veículo cadastrada' },
    // total geral quando a lista é paginada
    total: { type: Number, default: null },
    mostrarRegistrarSaida: { type: Boolean, default: false },
  },
  setup() {

    const router = useRouter();

    const mapMoradores = computed(()=>useMoradores.state.moradores.map)

    const mapPortaria = computed(()=>usePortarias.state.portarias.map)

    const trafegoSelecionado = ref({})
    const visualizarImagem = (trafego) => {
      trafegoSelecionado.value = trafego;
      showModal.value = false
      setTimeout(()=>{
        showModal.value = true
      }, 100)
    }

    const showModal = ref(false);

    const saidaManual = async (trafego) => {
      const confirma = confirm(`Deseja realmente registrar saída do veículo ${trafego.placa}?`);
      if (confirma) {
        showModal.value = false;
        try {
          await useTrafegos.actions.registrarSaidaManual(trafego.id, usePortarias.state.portarias.selecionada.id);
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

    // ---------- associação com uma saída sem entrada (painel lateral)
    const saidaSelecionada = computed(() => useSaidasNaoIdentificadas.state.interacao.selecionada);
    const saidaArrastada = computed(() => useSaidasNaoIdentificadas.state.interacao.arrastando);
    const alvoId = ref(null);

    const saidaEmUso = () => saidaArrastada.value || saidaSelecionada.value;

    const entradaPosteriorASaida = (trafego) => !!saidaEmUso() && !podeAssociar(trafego, saidaEmUso());

    // destaca as entradas com placa parecida com a da saída selecionada ou arrastada
    const placaParecida = (trafego) => {
      const saida = saidaEmUso();
      return podeAssociar(trafego, saida) && diferencasPlacas(trafego.placa, saida.placa) <= 2;
    };

    const permitirSoltar = (event, trafego) => {
      if (podeAssociar(trafego, saidaArrastada.value)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        alvoId.value = trafego.id;
      }
    };

    const sairDoAlvo = (trafego) => {
      if (alvoId.value === trafego.id) {
        alvoId.value = null;
      }
    };

    const soltar = (trafego) => {
      const saida = saidaArrastada.value;
      alvoId.value = null;
      if (podeAssociar(trafego, saida)) {
        useSaidasNaoIdentificadas.actions.finalizarArraste();
        useSaidasNaoIdentificadas.actions.pedirAssociacao(trafego, saida);
      }
    };

    // sentido inverso: a entrada é arrastada até um card de saída, no painel lateral
    const iniciarArrasteEntrada = (event, trafego) => {
      event.dataTransfer.effectAllowed = 'move';
      // necessário para o Firefox iniciar o arraste
      event.dataTransfer.setData('text/plain', `entrada:${trafego.id}`);
      // o estado muda depois do dragstart: alterar a tela durante o evento faz o Chrome cancelar o arraste
      setTimeout(() => useSaidasNaoIdentificadas.actions.iniciarArrasteEntrada(trafego), 0);
    };

    const finalizarArrasteEntrada = () => {
      useSaidasNaoIdentificadas.actions.finalizarArrasteEntrada();
    };

    const associarSaida = (trafego) => {
      if (podeAssociar(trafego, saidaSelecionada.value)) {
        useSaidasNaoIdentificadas.actions.pedirAssociacao(trafego, saidaSelecionada.value);
      }
    };

    return {
      mapMoradores,
      mapPortaria,
      showModal,
      trafegoSelecionado,
      visualizarImagem,
      saidaManual,
      editarTrafego,
      saidaSelecionada,
      alvoId,
      podeAssociar,
      entradaPosteriorASaida,
      placaParecida,
      permitirSoltar,
      sairDoAlvo,
      soltar,
      iniciarArrasteEntrada,
      finalizarArrasteEntrada,
      associarSaida
    }
  },
}
</script>
