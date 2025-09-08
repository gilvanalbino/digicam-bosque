<template>
  <Main :titulo="titulo" menu="Green List">
    <div class="mt-10 sm:mt-0">
      <div class="md:grid md:grid-cols-3 md:gap-6">
        <div class="mt-5 md:mt-0 md:col-span-2">
          <div class="shadow overflow-hidden sm:rounded-md">
            <div class="px-4 py-5 bg-white sm:p-6">
              <div class="grid grid-cols-6 gap-6">
                <div class="col-span-6 sm:col-span-2">
                  <label for="placa" class="block text-sm font-medium text-gray-700">Placa</label>
                  <input type="text" v-model="whiteList.placa" name="placa" id="placa" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.placa" class="text-red-500">{{mapErro.placa}}</p>
                </div>
                <div class="col-span-6 sm:col-span-2">
                  <label for="marca" class="block text-sm font-medium text-gray-700">Marca</label>
                  <input type="text" v-model="whiteList.marca" name="marca" id="marca" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.marca" class="text-red-500">{{mapErro.marca}}</p>
                </div>
                <div class="col-span-6 sm:col-span-2">
                  <label for="modelo" class="block text-sm font-medium text-gray-700">Modelo</label>
                  <input type="text" v-model="whiteList.modelo" name="modelo" id="modelo" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.modelo" class="text-red-500">{{mapErro.modelo}}</p>
                </div>
                <div class="col-span-6 sm:col-span-6">
                  <label for="nome" class="block text-sm font-medium text-gray-700">Nome</label>
                  <input type="text" v-model="whiteList.nome" name="nome" id="nome" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.nome" class="text-red-500">{{mapErro.nome}}</p>
                </div>
                <div class="col-span-6 sm:col-span-3">
                  <label for="endereco" class="block text-sm font-medium text-gray-700">Endereço</label>
                  <input type="text" v-model="whiteList.endereco" name="endereco" id="endereco" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.endereco" class="text-red-500">{{mapErro.endereco}}</p>
                </div>
                <div class="col-span-6 sm:col-span-1">
                  <label for="numero" class="block text-sm font-medium text-gray-700">Número</label>
                  <input type="text" v-model="whiteList.numero" name="numero" id="numero" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.numero" class="text-red-500">{{mapErro.numero}}</p>
                </div>
                <div class="col-span-6 sm:col-span-2">
                  <label for="complemento" class="block text-sm font-medium text-gray-700">Complemento</label>
                  <input type="text" v-model="whiteList.complemento" name="complemento" id="complemento" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.complemento" class="text-red-500">{{mapErro.complemento}}</p>
                </div>
              </div>
            </div>
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
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { notify } from "notiwind"

import Main from '../layout/Main.vue'

import useLogin from '../../composables/useLogin'
import useClientes from '../../composables/useClientes'

import { inserirWhiteList, obterWhiteList, atualizarWhiteList } from '../../database/dbWhiteList';

export default {
  components: { Main },
  setup() {
    const route = useRoute();
    const router = useRouter();

    const titulo = ref("Novo veículo para a Green List")
    const whiteList = ref({})
    const mapErro = ref({})

    onMounted(async () => {
      const id = route.params.id;
      if (id) {
        titulo.value = "Editando veículo da Green List"
        whiteList.value = await obterWhiteList(useLogin.state.auth.token, id)
      }
    });

    const salvar =  async () => {
      if (!validar(whiteList.value, mapErro)) {
        try {
          if (whiteList.value.id) {
            await atualizarWhiteList(useLogin.state.auth.token, whiteList.value)
          } else {
            let client_id;
            const user = useLogin.state.auth.user;
            // if (user.admin) {
            //   client_id = useClientes.state.clientes.selecionado.id;
            // } else {
            //   debugger;
            //   client_id = user.client_id;
            // }
            client_id = useClientes.state.clientes.selecionado.id;
            whiteList.value.client_id = client_id;
            await inserirWhiteList(useLogin.state.auth.token, whiteList.value)
          }
          notify({
            group: "success",
            title: "Sucesso",
            text: "Veículo foi salvo com sucesso na Green List!"
          }, 4000)
          router.replace('/greenList');
        } catch (error) {
          console.log("ERRO salvando whiteList", error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro salvando whiteList!"
          }, 4000)
          router.replace('/greenList');
        }
      }
    }

    const cancelar = () => {
      router.replace('/greenList');
    }

    return {
      titulo,
      whiteList,
      mapErro,
      salvar,
      cancelar
    }
  },
}

const validar = (whiteList, mapErro) => {
  let erro=false;
  if (!whiteList.placa) {
    mapErro.value.placa = "Informe a placa"
    erro = true;
  } else {
    mapErro.value.placa = ""
  }

  if (!whiteList.marca) {
    mapErro.value.marca = "Informe a marca"
    erro = true;
  } else {
    mapErro.value.marca = ""
  }

  if (!whiteList.modelo) {
    mapErro.value.modelo = "Informe o modelo"
    erro = true;
  } else {
    mapErro.value.modelo = ""
  }

  // if (!whiteList.nome) {
  //   mapErro.value.nome = "Informe o nome"
  //   erro = true;
  // } else {
  //   mapErro.value.nome = ""
  // }

  if (!whiteList.endereco) {
    mapErro.value.endereco = "Informe o endereço"
    erro = true;
  } else {
    mapErro.value.endereco = ""
  }

  // if (!whiteList.numero) {
  //   mapErro.value.numero = "Informe o número"
  //   erro = true;
  // } else {
  //   mapErro.value.numero = ""
  // }

  // if (!whiteList.complemento) {
  //   mapErro.value.complemento = "Informe o complemento"
  //   erro = true;
  // } else {
  //   mapErro.value.complemento = ""
  // }

  return erro;
}


</script>

<style>
</style>
