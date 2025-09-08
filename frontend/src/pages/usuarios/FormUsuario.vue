<template>
  <Main :titulo="titulo" menu="Cadastro de Usuários">
    <div class="mt-10 sm:mt-0">
      <div class="md:grid md:grid-cols-3 md:gap-6">
        <div class="mt-5 md:mt-0 md:col-span-2">
          <div class="shadow overflow-hidden sm:rounded-md">
            <div class="px-4 py-5 bg-white sm:p-6">
              <div class="grid grid-cols-6 gap-6">

                <div class="col-span-6 sm:col-span-6">
                  <label for="name" class="block text-sm font-medium text-gray-700">Nome</label>
                  <input type="text" v-model="usuario.name" name="name" id="name" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.name" class="text-red-500">{{mapErro.name}}</p>
                </div>

                <div class="col-span-6 sm:col-span-6">
                  <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                  <input type="text" v-model="usuario.email" name="email" id="email" autocomplete="given-email" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.email" class="text-red-500">{{mapErro.email}}</p>
                </div>

                <div class="col-span-6 sm:col-span-3">
                  <label for="new_password" class="block text-sm font-medium text-gray-700">Senha</label>
                  <input type="password" v-model="usuario.new_password" name="new_password" id="new_password" autocomplete="given-new_password" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.new_password" class="text-red-500">{{mapErro.new_password}}</p>
                </div>

                <div class="col-span-6 sm:col-span-3">
                  <label for="new_password_confirmation" class="block text-sm font-medium text-gray-700">Confirmar Senha</label>
                  <input type="password" v-model="usuario.new_password_confirmation" name="new_password_confirmation" id="new_password_confirmation" autocomplete="given-new_password_confirmation" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.new_password_confirmation" class="text-red-500">{{mapErro.new_password_confirmation}}</p>
                </div>

                <div class="col-span-6 sm:col-span-3">
                  <label for="email" class="block text-sm font-medium text-gray-700">Admin</label>
                  <Switch v-model="usuario.admin_client" :class="[usuario.admin_client ? 'bg-indigo-600' : 'bg-gray-200', 'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500']">
                    <span class="sr-only">Use setting</span>
                    <span aria-hidden="true" :class="[usuario.admin_client ? 'translate-x-5' : 'translate-x-0', 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200']" />
                  </Switch>
                </div>

                <div class="col-span-6 sm:col-span-3">
                  <label for="email" class="block text-sm font-medium text-gray-700">Ativo</label>
                  <Switch v-model="usuario.active" :class="[usuario.active ? 'bg-indigo-600' : 'bg-gray-200', 'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500']">
                    <span class="sr-only">Use setting</span>
                    <span aria-hidden="true" :class="[usuario.active ? 'translate-x-5' : 'translate-x-0', 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200']" />
                  </Switch>
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

import { inserirUsuario, obterUsuario, atualizarUsuario } from '../../database/dbUsuarios';

import { Switch } from '@headlessui/vue'

export default {
  components: {
    Main,
    Switch
  },
  setup() {
    const route = useRoute();
    const router = useRouter();

    const titulo = ref("Novo Usuário")
    const usuario = ref({})
    const mapErro = ref({})

    onMounted(async () => {
      const id = route.params.id;
      if (id) {
        titulo.value = "Editando Usuário"
        usuario.value = await obterUsuario(useLogin.state.auth.token, id)
      } else {
        usuario.value.active = true
        usuario.value.admin_client = false
      }
      usuario.value.new_password = ""
      usuario.value.new_password_confirmation = ""
    });

    const salvar =  async () => {
      if (!validar(usuario.value, mapErro)) {
        try {
          if (usuario.value.new_password) {
            usuario.value.password = usuario.value.new_password;
          }
          if (usuario.value.id) {
            await atualizarUsuario(useLogin.state.auth.token, usuario.value)
          } else {
            let client_id;
            const user = useLogin.state.auth.user;
            if (user.admin) {
              client_id = useClientes.state.clientes.selecionado.id;
            } else {
              client_id = user.client_id;
            }
            usuario.value.client_id = client_id;
            usuario.value.admin = false;
            await inserirUsuario(useLogin.state.auth.token, usuario.value)
          }
          notify({
            group: "success",
            title: "Sucesso",
            text: "Usuário foi salvo com sucesso!"
          }, 4000)
          router.replace('/usuarios');
        } catch (error) {
          console.log("ERRO salvando usuário", error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro salvando usuário!"
          }, 4000)
          router.replace('/usuarios');
        }
      }
    }
    const cancelar = () => {
      router.replace('/usuarios');
    }

    return {
      titulo,
      usuario,
      mapErro,
      salvar,
      cancelar
    }
  },
}

const validar = (usuario, mapErro) => {
  let erro=false;
  if (!usuario.name) {
    mapErro.value.name = "Informe o nome do usuário"
    erro = true;
  } else {
    mapErro.value.name = ""
  }

  if (!usuario.email) {
    mapErro.value.email = "Informe o email do usuário"
    erro = true;
  } else {
    mapErro.value.email = ""
  }

  if (!usuario.id && !usuario.new_password) {
    mapErro.value.new_password = "Informe a senha do usuário"
    erro = true;
  } else {
    mapErro.value.new_password = ""
  }

  if (usuario.new_password && usuario.new_password.length < 8) {
    mapErro.value.new_password = "A senha deve ter 8 caracteres"
    erro = true;
  } else {
    mapErro.value.new_password = ""
  }


  if (usuario.new_password !== usuario.new_password_confirmation) {
    mapErro.value.new_password_confirmation = "A confirmação da senha está errada"
    erro = true;
  } else {
    mapErro.value.new_password_confirmation = ""
  }


  return erro;
}


</script>

<style>
</style>
