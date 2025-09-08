<template>
  <Main titulo="Lista de Usuários" menu="Cadastro de Usuários">
    <template v-slot:buttons>
      <button type="button" @click="adicionar" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        Novo Usuário
      </button>
    </template>

    <div class="mt-5 flex flex-col">
      <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div v-if="usuarios.length===0">Nenhuma usuario cadastrada</div>
          <div  v-if="usuarios.length>0" class="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ativo
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Editar</span>
                    <span class="sr-only">Remover</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="usuario in usuarios" :key="usuario.id">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                          {{ usuario.name }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                          {{ usuario.email }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                          {{ usuario.admin_client }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                          {{ usuario.active }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <router-link  :to="'/usuarios/'+usuario.id" class="text-indigo-600 hover:text-indigo-900">Editar</router-link>
                    <a href="#" @click="remover(usuario.id)" class="text-indigo-600 hover:text-indigo-900 ml-5">Remover</a>
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

import { listarUsuarios, removerUsuario } from '../../database/dbUsuarios';

import useClientes from '../../composables/useClientes'
import useLogin from '../../composables/useLogin';

export default {
  components: {Main},
  setup() {
    const router = useRouter();

    const adicionar = async () => {
      router.replace('/usuarios/novo');
    }

    const remover = async(id)=>{
      const confirmaRemocao = confirm("Deseja realmente remover o usuário?");
      if (confirmaRemocao) {
        try {
          // remove o cliente
          console.log('Removendo usuario ', id)
          await removerUsuario(useLogin.state.auth.token, id);

          // carregando nova lista de usuários
          usuarios.value = await listarUsuarios(useLogin.state.auth.token, useClientes.state.clientes.selecionado.id)
          notify({
            group: "success",
            title: "Sucesso",
            text: "Usuário removido com sucesso!"
          }, 4000)
        } catch (error) {
          console.log("ERRO removendo usuário", error);
          notify({
            group: "error",
            title: "Error",
            text: "Erro removendo usuário!"
          }, 4000)
        }
      }

    }

    const usuarios = ref([])

    onMounted(async ()=>{
      usuarios.value = await listarUsuarios(useLogin.state.auth.token, useClientes.state.clientes.selecionado.id)
    })

    return {
      usuarios,
      adicionar,
      remover
    }
  },
}
</script>

<style>
</style>
