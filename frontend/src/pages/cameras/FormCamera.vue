<template>
  <Main :titulo="titulo" menu="Cadastro de Câmeras">
    <div class="mt-10 sm:mt-0">
      <div class="md:grid md:grid-cols-3 md:gap-6">
        <div class="mt-5 md:mt-0 md:col-span-2">
          <div class="shadow overflow-hidden sm:rounded-md">
            <div class="px-4 py-5 bg-white sm:p-6">
              <div class="grid grid-cols-6 gap-6">
                <div class="col-span-6 sm:col-span-6">
                  <label for="nome" class="block text-sm font-medium text-gray-700">Nome</label>
                  <input type="text" v-model="camera.nome" name="nome" id="nome" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.nome" class="text-red-500">{{mapErro.nome}}</p>
                </div>
                <div class="col-span-6 sm:col-span-6">
                  <label for="url" class="block text-sm font-medium text-gray-700">URL</label>
                  <input type="text" v-model="camera.url" name="url" id="url" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.url" class="text-red-500">{{mapErro.url}}</p>
                </div>
                <div class="col-span-6 sm:col-span-3">
                  <label for="modelo" class="block text-sm font-medium text-gray-700">Modelo</label>
                  <select id="modelo" name="modelo" v-model="camera.modelo" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                    <option value="hikvision-DS-2CD7A26G0/P-IZS">HikVision DS-2CD7A26G0/P-IZS</option>
                    <option value="hikvision-iDS-2CD7A26G0/P-IZHS">HikVision iDS-2CD7A26G0/P-IZHS</option>
                  </select>
                  <p v-if="mapErro.modelo" class="text-red-500">{{mapErro.modelo}}</p>
                </div>
                <div class="col-span-6 sm:col-span-3">
                  <label for="portaria" class="block text-sm font-medium text-gray-700">Portaria</label>
                  <select id="portaria" name="portaria" v-model="camera.portaria_id" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                    <option v-for="portaria in portarias" :key="portaria" :value="portaria.id">{{ portaria.nome }}</option>
                  </select>
                  <p v-if="mapErro.portaria_id" class="text-red-500">{{mapErro.portaria_id}}</p>
                </div>
                <div class="col-span-6 sm:col-span-3">
                  <label for="posicionamento" class="block text-sm font-medium text-gray-700">Posicionamento</label>
                  <select id="posicionamento" name="posicionamento" v-model="camera.posicionamento" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                    <option value="F">Direcionada para fora</option>
                    <option value="T">Direcionada para dentro</option>
                  </select>
                  <p v-if="mapErro.posicionamento" class="text-red-500">{{mapErro.posicionamento}}</p>
                </div>
                <div class="col-span-6 sm:col-span-3">
                  <label for="sentido" class="block text-sm font-medium text-gray-700">Sentido Default</label>
                  <select id="sentido" name="sentido" v-model="camera.sentido" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                    <option value="E">Entrada</option>
                    <option value="S">Saída</option>
                    <!-- <option value="ES">Entrada/Saída</option> -->
                  </select>
                  <p v-if="mapErro.sentido" class="text-red-500">{{mapErro.sentido}}</p>
                </div>
                <div class="col-span-6 sm:col-span-3">
                  <label for="login-camera" class="block text-sm font-medium text-gray-700">Login</label>
                  <input type="text" v-model="camera.login" name="login-camera" id="login-camera" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.login" class="text-red-500">{{mapErro.login}}</p>
                </div>
                <div class="col-span-6 sm:col-span-3">
                  <label for="senha-camera" class="block text-sm font-medium text-gray-700">Senha</label>
                  <input type="password" v-model="camera.senha" name="senha-camera" id="senha-camera" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.senha" class="text-red-500">{{mapErro.senha}}</p>
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
import usePortarias from '../../composables/usePortarias'

import { inserirCamera, obterCamera, atualizarCamera } from '../../database/dbCameras';

export default {
  components: { Main },
  setup() {
    const route = useRoute();
    const router = useRouter();

    const titulo = ref("Nova Câmera")
    const camera = ref({})
    const mapErro = ref({})

    const portarias = computed(()=>usePortarias.state.portarias.lista)

    onMounted(async () => {
      const id = route.params.id;
      if (id) {
        titulo.value = "Editando Câmera"
        try {
          camera.value = await obterCamera(useLogin.state.auth.token, id)
        } catch (error) {
          router.replace('/cameras');
          console.log("ERRO obtendo dados da camera", error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro obtendo dados da camera!"
          }, 4000)
        }
      }
    });

    const salvar =  async () => {
      // console.log("Dados camera: ", toRaw(camera.value))
      if (!validar(camera.value, mapErro)) {
        try {
          if (camera.value.id) {
            console.log("camera: ", toRaw(camera.value));
            await atualizarCamera(useLogin.state.auth.token, camera.value)
          } else {
            let client_id;
            const user = useLogin.state.auth.user;
            if (user.admin) {
              client_id = useClientes.state.clientes.selecionado.id;
            } else {
              client_id = user.client_id;
            }
            camera.value.client_id = client_id;
            await inserirCamera(useLogin.state.auth.token, camera.value)
          }
          notify({
            group: "success",
            title: "Sucesso",
            text: "Camera foi salva com sucesso!"
          }, 4000)
          router.replace('/cameras');
        } catch (error) {
          console.log("ERRO salvando camera", error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro salvando camera!"
          }, 4000)
        }
      }
    }

    const cancelar = () => {
      router.replace('/cameras');
    }

    return {
      titulo,
      camera,
      portarias,
      mapErro,
      salvar,
      cancelar
    }
  },
}

const validar = (camera, mapErro) => {
  let erro=false;
  if (!camera.nome) {
    mapErro.value.nome = "Informe o nome da câmera"
    erro = true;
  } else {
    mapErro.value.name = ""
  }

  if (!camera.url) {
    mapErro.value.url = "Informe a url da câmera"
    erro = true;
  } else {
    mapErro.value.url = ""
  }

  if (!camera.modelo) {
    mapErro.value.modelo = "Informe a modelo da câmera"
    erro = true;
  } else {
    mapErro.value.modelo = ""
  }

  if (!camera.portaria_id) {
    mapErro.value.portaria_id = "Informe a portaria da câmera"
    erro = true;
  } else {
    mapErro.value.portaria_id = ""
  }

  if (!camera.sentido) {
    mapErro.value.sentido = "Informe a sentido da câmera"
    erro = true;
  } else {
    mapErro.value.sentido = ""
  }

  if (!camera.posicionamento) {
    mapErro.value.posicionamento = "Informe o posicionamento da câmera"
    erro = true;
  } else {
    mapErro.value.posicionamento = ""
  }


  return erro;
}


</script>

<style>
</style>
