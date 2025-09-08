<template>
  <div class="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8"
       style="background-repeat: no-repeat; background-size: cover; background-blend-mode: multiply;background-position: center center;background-image: url('background.jpg');">
    <div>
      <img style="width: 150px;" src="/LogoDigitto2018LetraBranca.png"/>
      <div style="position: relative; top: -14px; left: 80px" class="text-white italic">
        <span>do</span>&nbsp;<span class="text-green-500 text-lg">Brasil</span>
      </div>
    </div>
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <h2 class="mt-40 text-center text-6xl font-extrabold text-white">
        D  I  G  I  C  A  M
      </h2>
    </div>

    <div class="mt-8 mb-80 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <form class="space-y-6" action="#" method="POST">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700">
              Email
            </label>
            <div class="mt-1">
              <input id="email" name="email" v-model="email" type="email" autocomplete="email" required="" class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm" />
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">
              Senha
            </label>
            <div class="mt-1">
              <input id="password" v-model="password" name="password" type="password" autocomplete="current-password" required="" class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm" />
            </div>
          </div>

          <div class="text-red-500">{{msgErro}}</div>

          <div>
            <button type="button" @click="userSignIn" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
              Entrar
            </button>
          </div>
        </form>

      </div>
      <div class="w-full flex text-sm justify-end py-2 text-gray-400">versão 1.0.25</div>
    </div>
  </div>
</template>

<script>
// import useVuelidate from '@vuelidate/core'
// import { required, email } from '@vuelidate/validators'
import { defineComponent } from 'vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import useLogin from '../../composables/useLogin'
import useClientes from '../../composables/useClientes'

export default defineComponent({
  name: 'Login',
  components: {},
  setup() {
    const router = useRouter();
    const password = ref('');
    const isPwd = ref(true);
    const email = ref('');
    const msgErro= ref('')

    const userSignIn = async () => {
      if (email.value && password.value) {
        let logou = false;
        try {
          await useLogin.actions.login({ email: email.value, password: password.value });
          logou = true
        } catch (error) {
          msgErro.value = "Credenciais inválidas ou usuário inexistente!"
        }
        if (logou){
          // carrega os clientes e as portarias
          try {
            await useClientes.actions.carregarClientes()
          } catch (error) {
            console.log("erro disparando ação atualizar clientes", error);
          }
          router.replace('/');
        }
      } else {
        msgErro.value = "Por favor, informe o email e a senha";
      }
      // return false;
    };
    return {
      password,
      isPwd,
      email,
      msgErro,
      userSignIn,
    };

  },
});
</script>

<style scoped>

</style>
