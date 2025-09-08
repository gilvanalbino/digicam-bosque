<template>
  <Main :titulo="titulo" menu="Cadastro de Moradores">
    <div class="mt-10 sm:mt-0">
      <div class="md:grid md:grid-cols-3 md:gap-6">
        <div class="mt-5 md:mt-0 md:col-span-2">
          <div class="shadow overflow-hidden sm:rounded-md">
            <div class="px-4 py-5 bg-white sm:p-6">
              <div class="grid grid-cols-6 gap-6">
                <div class="col-span-6 sm:col-span-6">
                  <label for="nome" class="block text-sm font-medium text-gray-700">Nome</label>
                  <input type="text" v-model="morador.nome" name="nome" id="nome" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.nome" class="text-red-500">{{mapErro.nome}}</p>
                </div>
                <div class="col-span-6 sm:col-span-6">
                  <label for="endereco" class="block text-sm font-medium text-gray-700">Endereço</label>
                  <input type="text" v-model="morador.endereco" name="endereco" id="endereco" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.endereco" class="text-red-500">{{mapErro.endereco}}</p>
                </div>
                <div class="col-span-6 sm:col-span-6">
                  <label for="observacao" class="block text-sm font-medium text-gray-700">Observação</label>
                  <input type="text" v-model="morador.observacao" name="observacao" id="observacao" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.observacao" class="text-red-500">{{mapErro.observacao}}</p>
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
import { ref, onMounted, computed, toRaw } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { notify } from "notiwind"

import Main from '../layout/Main.vue'

import useLogin from '../../composables/useLogin'
import useClientes from '../../composables/useClientes'

import { inserirMorador, obterMorador, atualizarMorador } from '../../database/dbMoradores';

export default {
  components: { Main },
  setup() {
    const route = useRoute();
    const router = useRouter();

    const titulo = ref("Novo Morador")
    const morador = ref({})
    const mapErro = ref({})

    onMounted(async () => {
      const id = route.params.id;
      if (id) {
        titulo.value = "Editando Morador"
        try {
          morador.value = await obterMorador(useLogin.state.auth.token, id)
        } catch (error) {
          router.replace('/moradores');
          console.log("ERRO obtendo dados do morador", error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro obtendo dados do morador!"
          }, 4000)
        }
      }
    });

    const salvar =  async () => {
      if (morador.value.observacao==null) {
        morador.value.observacao = "";
      }
      // console.log("Dados morador: ", toRaw(morador.value))
      if (!validar(morador.value, mapErro)) {
        try {
          if (morador.value.id) {
            await atualizarMorador(useLogin.state.auth.token, morador.value)
          } else {
            let client_id;
            const user = useLogin.state.auth.user;
            if (user.admin) {
              client_id = useClientes.state.clientes.selecionado.id;
            } else {
              client_id = user.client_id;
            }
            morador.value.client_id = client_id;
            await inserirMorador(useLogin.state.auth.token, morador.value)
          }
          notify({
            group: "success",
            title: "Sucesso",
            text: "Morador foi salva com sucesso!"
          }, 4000)
          router.replace('/moradores');
        } catch (error) {
          console.log("ERRO salvando morador", error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro salvando morador!"
          }, 4000)
        }
      }
    }
    const cancelar = () => {
      router.replace('/moradores');
    }

    return {
      titulo,
      morador,
      mapErro,
      salvar,
      cancelar
    }
  },
}

const validar = (morador, mapErro) => {
  let erro=false;
  if (!morador.nome) {
    mapErro.value.nome = "Informe o nome do morador"
    erro = true;
  } else {
    mapErro.value.name = ""
  }

  if (!morador.endereco) {
    mapErro.value.endereco = "Informe o endereço do morador"
    erro = true;
  } else {
    mapErro.value.endereco = ""
  }

  // if (!morador.observacao) {
  //   mapErro.value.observacao = "Informe a observação do morador"
  //   erro = true;
  // } else {
  //   mapErro.value.observacao = ""
  // }

  return erro;
}


</script>

<style>
</style>
