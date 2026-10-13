<template>
  <Main titulo="Alterar senha" menu="Alterar Senha">
    <div class="mt-10 sm:mt-0">
      <div class="md:grid md:grid-cols-3 md:gap-6">
        <form class="mt-5 md:mt-0 md:col-span-2" @submit.prevent="salvar">
          <div class="shadow overflow-hidden sm:rounded-md">
            <div class="px-4 py-5 bg-white sm:p-6">
              <p class="text-sm text-gray-500">Usuário: {{ email }}</p>
              <!-- ajuda os gerenciadores de senha a associar a senha ao usuário -->
              <input type="text" name="username" autocomplete="username" :value="email" class="hidden" readonly />
              <div class="mt-4 grid grid-cols-6 gap-6">
                <div class="col-span-6 sm:col-span-4">
                  <label for="senhaAtual" class="block text-sm font-medium text-gray-700">Senha atual</label>
                  <input type="password" v-model="senhaAtual" name="senhaAtual" id="senhaAtual" autocomplete="current-password" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.senhaAtual" class="text-red-500">{{ mapErro.senhaAtual }}</p>
                </div>
                <div class="col-span-6 sm:col-span-4">
                  <label for="novaSenha" class="block text-sm font-medium text-gray-700">Nova senha</label>
                  <input type="password" v-model="novaSenha" name="novaSenha" id="novaSenha" autocomplete="new-password" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.novaSenha" class="text-red-500">{{ mapErro.novaSenha }}</p>
                  <p v-else class="mt-1 text-xs text-gray-500">Pelo menos {{ TAMANHO_MINIMO }} caracteres.</p>
                </div>
                <div class="col-span-6 sm:col-span-4">
                  <label for="confirmacao" class="block text-sm font-medium text-gray-700">Repita a nova senha</label>
                  <input type="password" v-model="confirmacao" name="confirmacao" id="confirmacao" autocomplete="new-password" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  <p v-if="mapErro.confirmacao" class="text-red-500">{{ mapErro.confirmacao }}</p>
                </div>
              </div>
            </div>
            <div class="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <button type="button" @click="cancelar" class="mr-2 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Cancelar
              </button>
              <button type="submit" :disabled="salvando" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                Alterar senha
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </Main>
</template>

<script>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { notify } from "notiwind"

import Main from '../layout/Main.vue'

import { alterarMinhaSenha } from '../../database/dbUsuarios';

import useLogin from '../../composables/useLogin';

const TAMANHO_MINIMO = 8;

export default {
  components: {Main},
  setup() {
    const router = useRouter();

    const email = useLogin.state.auth.user ? useLogin.state.auth.user.email : '';
    const senhaAtual = ref('');
    const novaSenha = ref('');
    const confirmacao = ref('');
    const mapErro = ref({});
    const salvando = ref(false);

    const validar = () => {
      const erros = {};
      if (!senhaAtual.value) {
        erros.senhaAtual = 'Informe a senha atual';
      }
      if (novaSenha.value.length < TAMANHO_MINIMO) {
        erros.novaSenha = `A nova senha deve ter pelo menos ${TAMANHO_MINIMO} caracteres`;
      } else if (novaSenha.value === senhaAtual.value) {
        erros.novaSenha = 'A nova senha deve ser diferente da atual';
      }
      if (confirmacao.value !== novaSenha.value) {
        erros.confirmacao = 'As senhas não conferem';
      }
      mapErro.value = erros;
      return Object.keys(erros).length === 0;
    }

    const salvar = async () => {
      if (!validar() || salvando.value) return;
      salvando.value = true;
      try {
        const resposta = await alterarMinhaSenha(useLogin.state.auth.token, senhaAtual.value, novaSenha.value);
        if (!resposta || resposta.status !== 'OK') {
          const mensagem = (resposta && resposta.message) || 'Erro alterando a senha!';
          if (/atual/i.test(mensagem) && !/diferente/i.test(mensagem)) {
            mapErro.value = { senhaAtual: mensagem };
          } else {
            mapErro.value = { novaSenha: mensagem };
          }
          return;
        }
        notify({
          group: "success",
          title: "Sucesso",
          text: "Senha alterada com sucesso!"
        }, 4000)
        router.replace('/');
      } catch (error) {
        console.log("ERRO alterando a senha", error);
        notify({
          group: "error",
          title: "Error",
          text: "Erro alterando a senha!"
        }, 4000)
      } finally {
        salvando.value = false;
      }
    }

    const cancelar = () => {
      router.replace('/');
    }

    return {
      TAMANHO_MINIMO,
      email,
      senhaAtual,
      novaSenha,
      confirmacao,
      mapErro,
      salvando,
      salvar,
      cancelar,
    }
  },
}
</script>

<style>
</style>
