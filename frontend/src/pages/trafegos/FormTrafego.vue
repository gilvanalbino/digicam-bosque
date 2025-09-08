<template>
  <Main :titulo="titulo" menu="Tráfego">
    <div class="mt-10 sm:mt-0">
      <div class="md:grid md:grid-cols-3 md:gap-6">
        <div class="mt-5 md:mt-0 md:col-span-2">
          <div class="shadow overflow-hidden sm:rounded-md">
            <div class="px-4 py-5 bg-white sm:p-6">
              <div class="grid grid-cols-6 gap-6">

                <!-- foto carro -->
                <div class="cursor-pointer col-span-6 sm:col-span-3 md:col-span-6 lg:col-span-3 block w-full aspect-w-10 aspect-h-7 rounded-lg overflow-hidden">
                  <img :src="imagemCarro" />
                  <img v-if="imagemPlaca" :src="imagemPlaca" />
                </div>

                <!-- bloco esquerdo -->
                <div class="col-span-6 sm:col-span-3 md:col-span-6 lg:col-span-3">

                  <!-- Placa -->
                  <div class="col-span-3">
                    <label for="nome" class="block text-sm font-medium text-gray-700">Placa</label>
                    <input type="text" name="nome" id="nome" v-model="trafego.placa" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                    <p v-if="mapErro.placa" class="text-red-500">{{mapErro.placa}}</p>
                  </div>

                  <!-- Nome -->
                  <div class="mt-3 col-span-3">
                    <label for="nome" class="block text-sm font-medium text-gray-700">Nome</label>
                    <input type="text" name="nome" v-model="trafego.nome" id="nome" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                    <p v-if="mapErro.nome" class="text-red-500">{{mapErro.nome}}</p>
                  </div>

                </div>

                <!-- Destinos -->
                <div class="mt-3 col-span-6">
                  <RadioGroup v-model="trafego.destino">
                    <RadioGroupLabel>Destinos</RadioGroupLabel>
                    <div class="space-x-2 flex flex-row">
                      <RadioGroupOption
                        as="template"
                        v-for="destino in destinos"
                        :key="destino.nome"
                        :value="destino.code"
                        v-slot="{ active, checked }"
                      >
                        <div
                          :class="[
                            active
                              ? 'ring-2 ring-offset-2 ring-offset-indigo-500 ring-white ring-opacity-60'
                              : '',
                            checked ? 'bg-indigo-600 bg-opacity-75 text-white ' : 'bg-white ',
                          ]"
                          class="flex w-1/2 px-5 py-4 rounded-lg shadow-md cursor-pointer focus:outline-none"
                        >
                          <div class="flex-auto w-48 flex items-center justify-between">
                            <div class="text-sm">
                              <RadioGroupLabel
                                as="p"
                                :class="checked ? 'text-white' : 'text-gray-900'"
                                class="font-medium"
                              >
                                {{ destino.nome }}
                              </RadioGroupLabel>
                            </div>
                            <div v-show="checked" class="flex-shrink-0 text-white">
                              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none">
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="12"
                                  fill="#fff"
                                  fill-opacity="0.2"
                                />
                                <path
                                  d="M7 13l3 3 7-7"
                                  stroke="#fff"
                                  stroke-width="1.5"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </RadioGroupOption>
                    </div>
                  </RadioGroup>
                  <p v-if="mapErro.destino" class="text-red-500 mt-1">{{mapErro.destino}}</p>
                </div>
              </div>
            </div>

            <!-- moradores -->
            <div v-if="trafego.destino==='morador'" class="ml-5 mr-5 col-span-6 sm:col-span-2">
              <label for="morador" class="block text-sm font-medium text-gray-700">Morador</label>
              <select id="morador" name="morador" v-model="trafego.morador_destino_id" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                <option v-for="morador in moradores" :key="morador" :value="morador.id">{{ morador.nome }} - {{ morador.endereco }}</option>
              </select>
              <p v-if="mapErro.morador_destino_id" class="text-red-500">{{mapErro.morador_destino_id}}</p>
            </div>

            <!-- observacao -->
            <div class="ml-5 mr-5 mt-3 col-span-3">
              <label for="observacao" class="block text-sm font-medium text-gray-700">Observação</label>
              <input type="text" name="observacao" v-model="trafego.observacao" id="observacao" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
            </div>

            <!-- Button SAVE -->
            <div class="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <button type="button" @click="cancelar" class="mr-2 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Cancelar
              </button>
              <button type="button" @click="salvar" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Main>
</template>

<script>
import { ref, onMounted, computed, toRaw } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { RadioGroup, RadioGroupLabel, RadioGroupOption, RadioGroupDescription } from '@headlessui/vue'
import { notify } from "notiwind"

import Main from '../layout/Main.vue'

import usePortarias from '../../composables/usePortarias'
import useMorador from '../../composables/useMoradores'

const destinos = [
  { nome: 'Casa Morador', code: "morador" },
  { nome: 'Cruzar Condomínio', code: "cruzar"},
  { nome: 'Serviço', code:"servico" },
]

import useMoradores from '../../composables/useMoradores';
import useClientes from '../../composables/useClientes';
import useCameras from '../../composables/useCameras';
import useLogin from '../../composables/useLogin';

import { getPhoto } from '../../database/dbCameras'
import { obterImagemCarro } from '../../database/dbLogIdentificacao'

import { inserirTrafego, obterTrafego, atualizarTrafego } from '../../database/dbTrafegos'
import useLogIdentificacao from '../../composables/useLogIdentificacao';

export default {
  components: { Main, RadioGroup, RadioGroupLabel, RadioGroupOption, RadioGroupDescription },
  setup() {
    const route = useRoute();
    const router = useRouter();

    const titulo = ref(`Nova Entrada de Veículo - Portaria ${usePortarias.state.portarias.selecionada.nome}`);
    const trafego = ref({});
    const mapErro = ref({});

    const moradores = computed(() => useMoradores.state.moradores.lista)

    const portariaSelecionada = computed(() => usePortarias.state.portarias.selecionada)

    const imagemCarro = ref("")
    const imagemPlaca = ref("")

    onMounted(async () => {
      const id = route.params.id;
      if (id) {
        titulo.value = "Editando Entrada de Veículos"

        trafego.value = await obterTrafego(useLogin.state.auth.token, id)
      }

      // carregando moradores
      await useMoradores.actions.carregarMoradores(useClientes.state.clientes.selecionado.id)

      await useCameras.actions.carregarCameras(useClientes.state.clientes.selecionado.id);

      const camera = await useCameras.actions.getCameraEntrada(portariaSelecionada.value.id);
      if (camera==null) {
          notify({
            group: "error",
            title: "Error",
            text: "Não existe câmera de entrada nesta portaria!"
          }, 4000)
          router.replace('/');
      }

      console.log("route.path: ", route.path);
      if (route.path.indexOf("placaIdentificada")>=0) {
        // obter LogPlacaIdentificada pelo id
        useLogIdentificacao.actions.carregarIdentificacoes(camera.id);
        const logIdentificacaoId = parseInt(route.params.id);
        const logIdentificacao = useLogIdentificacao.actions.findById(logIdentificacaoId);
        console.log("logIdentificacao: ", toRaw(logIdentificacao))
        const responseImagemCarroInfo = await obterImagemCarro(useLogin.state.auth.token, logIdentificacaoId)
        imagemCarro.value = responseImagemCarroInfo.imagemCarro;
        imagemPlaca.value = logIdentificacao.imagem_placa;
        trafego.value.placa = logIdentificacao.placa;
        trafego.value.logIdentificacaoId = logIdentificacaoId
      } else {
        trafego.value.logIdentificacaoId = null;
        if (!id) {
          imagemCarro.value = await getPhoto(useLogin.state.auth.token, camera.id);
        } else {
          imagemCarro.value = `/images${trafego.value.imagem}`
        }
      }

    });

    // const pesquisaMorador = async (term) => {
    //   console.log("Pesquisa... ", term)
    //   if (term.length>1) {
    //     resultadoPesquisaMorador.value = useMorador.state.moradores.lista.filter((morador)=>morador.nome.toLowerCase().indexOf(term.toLowerCase())>=0);
    //   }
    // }

    // const selecionarMorador = async () => {
    // }

    // const moradores = computed(() => (useMoradores.state.moradores.lista.map((morador) => { return { id: morador.id, name: morador.nome } })));

    const salvar = async () => {
      if (!validar(trafego.value, mapErro)) {
        try {
          if (trafego.value.id) {
            await atualizarTrafego(useLogin.state.auth.token, trafego.value)
          } else {
            let client_id;
            const user = useLogin.state.auth.user;
            if (user.admin) {
              client_id = useClientes.state.clientes.selecionado.id;
            } else {
              client_id = user.client_id;
            }
            trafego.value.client_id = client_id;
            if (!trafego.value.logIdentificacaoId) {
              trafego.value.imagem = imagemCarro.value;
            } else {
              trafego.value.imagem = "imagem"; // por causa da performance... imagem será obtida do logIdentificacao no server
            }
            trafego.value.dataEntrada = new Date();
            trafego.value.portaria_entrada_id = usePortarias.state.portarias.selecionada.id;
            if (trafego.value.destino !== 'morador') {
              trafego.value.morador_destino_id = null;
            }

            await inserirTrafego(useLogin.state.auth.token, trafego.value)
          }
          notify({
            group: "success",
            title: "Sucesso",
            text: "Registro de entrada foi salva com sucesso!"
          }, 4000)
          router.replace('/');
        } catch (error) {
          console.log("ERRO salvando registro de entrada", error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro salvando registro de entrada!"
          }, 4000)
        }
      }
    }

    const cancelar = () => {
      router.replace('/');
    }

    return {
      titulo,
      trafego,
      mapErro,
      imagemCarro,
      imagemPlaca,
      destinos,
      portariaSelecionada,
      moradores,
      salvar,
      cancelar
    }
  },
}

const validar = (trafego, mapErro) => {
  console.log("validando trafego")
  let erro=false;

  // nome
  // if (!trafego.nome) {
  //   mapErro.value.nome = "Informe o nome"
  //   erro = true;
  // } else {
  //   mapErro.value.nome = ""
  // }

  // placa
  // const regexPlaca = /^[a-zA-Z]{3}[0-9]{4}$/;
  // const regexPlacaMercosulCarro = /^[a-zA-Z]{3}[0-9]{1}[a-zA-Z]{1}[0-9]{2}$/;
  // const regexPlacaMercosulMoto = /^[a-zA-Z]{3}[0-9]{2}[a-zA-Z]{1}[0-9]{1}$/;
  // if (!trafego.placa) {
  //   console.log("place: ", trafego.placa, !trafego.placa)
  //   mapErro.value.placa = "Informe a placa"
  //   erro = true;
  // } else if (!regexPlaca.test(trafego.placa) &&
  //     !regexPlacaMercosulCarro.test(trafego.placa) &&
  //     !regexPlacaMercosulMoto.test(trafego.placa)) {
  //   mapErro.value.placa = "Placa inválida"
  //   erro = true;
  // } else {
  //   mapErro.value.placa = ""
  // }

  // destino
  if (!trafego.destino) {
    mapErro.value.destino = "Informe o destino"
    erro = true;
  } else {
    mapErro.value.destino = ""
  }

  // morador
  // if (trafego.destino === 'morador' && !trafego.morador_destino_id) {
  //   mapErro.value.morador_destino_id = "Informe o morador"
  //   erro = true;
  // } else {
  //   mapErro.value.morador_destino_id = ""
  // }

  console.log("validacao Erro: ", toRaw(mapErro));
  return erro;
}


</script>

<style>
</style>
