<template>
  <Main titulo="Lista de Câmeras" menu="Cadastro de Câmeras">
    <template v-slot:buttons>
      <button type="button" @click="adicionar" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        Nova Câmera
      </button>
    </template>

    <div class="mt-5 flex flex-col">
      <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div v-if="cameras.length===0">Nenhuma camera cadastrada</div>
          <div  v-if="cameras.length>0" class="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    URL (Host:Port)
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Modelo
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sentido Default
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Posicionamento
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Portaria
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span></span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="camera in cameras" :key="camera.id">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ camera.nome }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ camera.url }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ mapModelos[camera.modelo] }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ mapSentido[camera.sentido] }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ mapPosicionamento[camera.posicionamento] }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">
                        {{ mapPortaria[camera.portaria_id] }}
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <router-link  :to="'/cameras/'+camera.id" class="text-indigo-600 hover:text-indigo-900">Editar</router-link>
                    <a href="#" @click="remover(camera.id)" class="text-indigo-600 hover:text-indigo-900 ml-5">Remover</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

  </Main>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { notify } from "notiwind"

import Main from '../layout/Main.vue'

import useCameras from '../../composables/useCameras'
import useClientes from '../../composables/useClientes'
import usePortarias from '../../composables/usePortarias'

export default {
  components: {Main},
  setup() {
    const router = useRouter();

    const mapSentido = {
      "E": "Entrada",
      "S": "Saída",
      "E/A": "Entrada/Saída"
    }

    const mapModelos = {
      "hikvision-DS-2CD7A26G0/P-IZS": "HikVision DS-2CD7A26G0/P-IZS",
      "hikvision-iDS-2CD7A26G0/P-IZHS": "HikVision iDS-2CD7A26G0/P-IZHS"
    }

    const mapPosicionamento = {
      "F":"Direcionada para fora",
      "T":"Direcionada para dentro"
    }

    const mapPortaria = ref({})

    const adicionar = async () => {
      router.replace('/cameras/novo');
    }

    const remover = async(id)=>{
      const confirmaRemocao = confirm("Deseja realmente remover a camera?");
      if (confirmaRemocao) {
        try {
          // remove o cliente
          console.log('Removendo camera ', id)
          await useCameras.actions.removerCamera(id);
          notify({
            group: "success",
            title: "Sucesso",
            text: "Câmera removida com sucesso!"
          }, 4000)
        } catch (error) {
          console.log("ERRO removendo câmera", error);
          notify({
            group: "error",
            title: "Error",
            text: "Erro removendo câmera!"
          }, 4000)
        }
      }

    }

    const cameras = computed(()=>useCameras.state.cameras.lista)

    onMounted(()=>{
      // faz um refresh da lista de clientes
      console.log("Recarregando clientes")
      useCameras.actions.carregarCameras(useClientes.state.clientes.selecionado.id);

      const portarias = usePortarias.state.portarias.lista
      for (const portaria of portarias) {
        mapPortaria.value[portaria.id] = portaria.nome
      }
    })

    return {
      cameras,
      mapSentido,
      mapModelos,
      mapPortaria,
      mapPosicionamento,
      adicionar,
      remover
    }
  },
}
</script>

<style>
</style>
