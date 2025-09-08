<template>
  <Main :titulo="titulo" menu="Red List">
    <div class="mt-10 sm:mt-0">
      <div class="md:grid md:grid-cols-3 md:gap-6">
        <div class="mt-5 md:mt-0 md:col-span-2">
          <div class="shadow overflow-hidden sm:rounded-md">
            <div class="px-4 py-5 bg-white sm:p-6">
              <div class="grid grid-cols-6 gap-6">
                <div class="col-span-6 sm:col-span-2">
                  <label for="placa" class="block text-sm font-medium text-gray-700">Placa</label>
                  <input type="text" v-model="blackList.placa" name="placa" id="placa" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.placa" class="text-red-500">{{mapErro.placa}}</p>
                </div>
                <div class="col-span-6 sm:col-span-2">
                  <label for="marca" class="block text-sm font-medium text-gray-700">Marca</label>
                  <input type="text" v-model="blackList.marca" name="marca" id="marca" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.marca" class="text-red-500">{{mapErro.marca}}</p>
                </div>
                <div class="col-span-6 sm:col-span-2">
                  <label for="modelo" class="block text-sm font-medium text-gray-700">Modelo</label>
                  <input type="text" v-model="blackList.modelo" name="modelo" id="modelo" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.modelo" class="text-red-500">{{mapErro.modelo}}</p>
                </div>
                <div class="col-span-6 sm:col-span-6">
                  <label for="motivo" class="block text-sm font-medium text-gray-700">Motivo</label>
                  <input type="text" v-model="blackList.motivo" name="motivo" id="motivo" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.motivo" class="text-red-500">{{mapErro.motivo}}</p>
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

import { inserirBlackList, obterBlackList, atualizarBlackList } from '../../database/dbBlackList';

export default {
  components: { Main },
  setup() {
    const route = useRoute();
    const router = useRouter();

    const titulo = ref("Novo veículo para a Red List")
    const blackList = ref({})
    const mapErro = ref({})

    onMounted(async () => {
      const id = route.params.id;
      if (id) {
        titulo.value = "Editando veículo da Red List"
        blackList.value = await obterBlackList(useLogin.state.auth.token, id)
      }
    });

    const salvar =  async () => {
      if (!validar(blackList.value, mapErro)) {
        try {
          if (blackList.value.id) {
            await atualizarBlackList(useLogin.state.auth.token, blackList.value)
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
            blackList.value.client_id = client_id;
            await inserirBlackList(useLogin.state.auth.token, blackList.value)
          }
          notify({
            group: "success",
            title: "Sucesso",
            text: "Veículo foi salvo com sucesso na Red List!"
          }, 4000)
          router.replace('/redList');
        } catch (error) {
          console.log("ERRO salvando blackList", error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro salvando blackList!"
          }, 4000)
          router.replace('/redList');
        }
      }
    }

    const cancelar = () => {
      router.replace('/redList');
    }

    return {
      titulo,
      blackList,
      mapErro,
      salvar,
      cancelar
    }
  },
}

const validar = (blackList, mapErro) => {
  let erro=false;
  if (!blackList.placa) {
    mapErro.value.placa = "Informe a placa"
    erro = true;
  } else {
    mapErro.value.placa = ""
  }

  if (!blackList.marca) {
    mapErro.value.marca = "Informe a marca"
    erro = true;
  } else {
    mapErro.value.marca = ""
  }

  if (!blackList.modelo) {
    mapErro.value.modelo = "Informe o modelo"
    erro = true;
  } else {
    mapErro.value.modelo = ""
  }

  return erro;
}


</script>

<style>
</style>
