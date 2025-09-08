<template>
  <Main :titulo="titulo" menu="Cadastro de Portarias">
    <div class="mt-10 sm:mt-0">
      <div class="md:grid md:grid-cols-3 md:gap-6">
        <div class="mt-5 md:mt-0 md:col-span-2">
          <div class="shadow overflow-hidden sm:rounded-md">
            <div class="px-4 py-5 bg-white sm:p-6">
              <div class="grid grid-cols-6 gap-6">
                <div class="col-span-6 sm:col-span-6">
                  <label for="nome" class="block text-sm font-medium text-gray-700">Nome</label>
                  <input type="text" v-model="portaria.nome" name="nome" id="nome" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.nome" class="text-red-500">{{mapErro.nome}}</p>
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

import { inserirPortaria, obterPortaria, atualizarPortaria } from '../../database/dbPortarias';

export default {
  components: { Main },
  setup() {
    const route = useRoute();
    const router = useRouter();

    const titulo = ref("Nova Portaria")
    const portaria = ref({})
    const mapErro = ref({})

    onMounted(async () => {
      const id = route.params.id;
      if (id) {
        titulo.value = "Editando Portaria"
        portaria.value = await obterPortaria(useLogin.state.auth.token, id)
      }
    });

    const salvar =  async () => {
      if (!validar(portaria.value, mapErro)) {
        try {
          if (portaria.value.id) {
            await atualizarPortaria(useLogin.state.auth.token, portaria.value)
          } else {
            let client_id;
            const user = useLogin.state.auth.user;
            if (user.admin) {
              client_id = useClientes.state.clientes.selecionado.id;
            } else {
              client_id = user.client_id;
            }
            portaria.value.client_id = client_id;
            await inserirPortaria(useLogin.state.auth.token, portaria.value)
          }
          notify({
            group: "success",
            title: "Sucesso",
            text: "Portaria foi salva com sucesso!"
          }, 4000)
          router.replace('/portarias');
        } catch (error) {
          console.log("ERRO salvando portaria", error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro salvando portaria!"
          }, 4000)
          router.replace('/trafegos');
        }
      }
    }

    const cancelar = () => {
      router.replace('/portarias');
    }

    return {
      titulo,
      portaria,
      mapErro,
      salvar,
      cancelar
    }
  },
}

const validar = (portaria, mapErro) => {
  let erro=false;
  if (!portaria.nome) {
    mapErro.value.nome = "Informe o nome da portaria"
    erro = true;
  } else {
    mapErro.value.nome = ""
  }

  return erro;
}


</script>

<style>
</style>
