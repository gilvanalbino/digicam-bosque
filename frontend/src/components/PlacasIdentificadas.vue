<template>
    <ModalDialog :show="showModal">
      <img v-if="logIdentificacaoSelecionadaImagem" :src="logIdentificacaoSelecionadaImagem" />
      <img v-if="logIdentificacaoSelecionada.imagem_placa" :src="logIdentificacaoSelecionada.imagem_placa" />
    </ModalDialog>
    <div class="mt-5 flex flex-col">
      <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <h3 class="text-sm leading-4 italic font-medium text-gray-500">
            Placas Identificadas - fila de veículos entrando e saindo
          </h3>
          <div v-if="logIdentificacaoList.length===0" class="mb-35 mt-2 text-sky-500">Nenhum placa identificada</div>
          <div v-else class="mb-3 overflow-x-scroll border-gray-200 sm:rounded-lg">
            <dl class="mt-2 gap-2 flex flex-row">
              <div v-for="logIdentificacao in logIdentificacaoList" :key="logIdentificacao.id" class="ml-1 mb-1 rounded-lg border border-gray-300 bg-white px-2 py-2 shadow-sm hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                <dt @click="visualizarImagem(logIdentificacao)" class="text-sm font-medium text-gray-500 truncate">
                  <img class="w-28 h-auto rounded-lg" :src="logIdentificacao.imagem_placa" alt="" />
                </dt>
                <dd class="mt-1 text-xl font-semibold text-gray-900">
                  {{ logIdentificacao.placa }}
                  <p class="text-gray-400 text-xs">
                    {{ formatarData(logIdentificacao.data).substr(11) }}
                  </p>
                  <div v-if="!logIdentificacao.imagem_pendente">
                    <router-link :to="'/trafegos/novo/placaIdentificada/'+logIdentificacao.id" class="mr-2 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                      Entrar
                    </router-link>
                  </div>
                  <a href="#" @click="remover(logIdentificacao.id)" class="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                      Descartar
                  </a>
                  <!-- <p class="text-sm text-gray-400">
                    {{ logIdentificacao.sentido }}
                  </p> -->
                  <p class="text-sm text-gray-400">
                    {{ logIdentificacao.action }}
                  </p>
                  <p class="text-sm text-gray-400">
                    {{ mapPortaria[logIdentificacao.Camera.portaria_id].nome}}
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
</template>

<script>
import { ref, onMounted, computed, toRaw } from 'vue';
import { notify } from "notiwind"

import useLogIdentificacao from '../composables/useLogIdentificacao';
import usePortarias from '../composables/usePortarias'

import { formatarData } from '../utils/dateUtil';

import { obterImagemCarro } from '../database/dbLogIdentificacao'

import ModalDialog from '../components/ModalDialog.vue';
import useLogin from '../composables/useLogin';

export default {
  components: { ModalDialog },
  setup() {
    const portariaSelecionada = computed(() => usePortarias.state.portarias.selecionada)
    const logIdentificacaoList = computed(() => useLogIdentificacao.state.identificacoes.lista)
    const mapPortaria = computed(()=> usePortarias.state.portarias.map)

    onMounted(async () => {
      if (usePortarias.state.portarias.selecionada) {
        await useLogIdentificacao.actions.carregarIdentificacoes(usePortarias.state.portarias.selecionada.id)
      } else {
        console.log("Nenhuma portaria selecionada")
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

    const logIdentificacaoSelecionada = ref({})
    const logIdentificacaoSelecionadaImagem = ref({})
    const visualizarImagem = (logIdentificacao) => {
      obterImagemCarro(useLogin.state.auth.token, logIdentificacao.id).then((response)=>{
        logIdentificacaoSelecionadaImagem.value = response.imagemCarro
      })

      logIdentificacaoSelecionada.value = logIdentificacao;
      showModal.value = false
      setTimeout(()=>{
        showModal.value = true
      }, 100)

    }

    const showModal = ref(false);

    return {
      portariaSelecionada,
      logIdentificacaoList,
      remover,
      formatarData,
      mapPortaria,
      showModal,
      visualizarImagem,
      logIdentificacaoSelecionada,
      logIdentificacaoSelecionadaImagem
    }
  },
}
</script>

<style>
</style>
