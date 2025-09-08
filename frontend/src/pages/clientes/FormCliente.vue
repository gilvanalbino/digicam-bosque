<template>
  <Main :titulo="titulo" menu="Cadastro de Clientes">
    <div class="mt-10 sm:mt-0">
      <div class="md:grid md:grid-cols-3 md:gap-6">
        <div class="mt-5 md:mt-0 md:col-span-2">
          <form action="#" method="POST">
            <div class="shadow overflow-hidden sm:rounded-md">
              <div class="px-4 py-5 bg-white sm:p-6">
                <div class="grid grid-cols-6 gap-6">
                  <div class="col-span-6 sm:col-span-6">
                    <label for="nome" class="block text-sm font-medium text-gray-700">Nome</label>
                    <input type="text" v-model="cliente.name" name="nome" id="nome" autocomplete="given-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                    <p v-if="mapErro.name" class="text-red-500">{{mapErro.name}}</p>
                  </div>

                  <div class="col-span-6 sm:col-span-3 lg:col-span-2">
                    <label for="location" class="block text-sm font-medium text-gray-700">Tipo Pessoa</label>
                    <select v-model="cliente.type" id="location" name="location" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                      <option value="PF" :selected="cliente.type==='PF'">Pessoa Física</option>
                      <option value="PJ" :selected="cliente.type==='PJ'">Pessoa Jurídica</option>
                    </select>
                    <p v-if="mapErro.type" class="text-red-500">{{mapErro.type}}</p>
                  </div>

                  <div class="col-span-6 sm:col-span-4">
                    <label for="cpfCnpj" class="block text-sm font-medium text-gray-700">CPF/CNPJ</label>
                    <input type="text" v-model="cliente.cpfCnpj" v-maska="['###.###.###-##', '##.###.###/####-##', '###.###.###/####-##']" name="cpfCnpj" id="cpfCnpj" autocomplete="family-name" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                    <p v-if="mapErro.cpfCnpj" class="text-red-500">{{mapErro.cpfCnpj}}</p>
                  </div>

                  <div class="col-span-6 sm:col-span-3 lg:col-span-2">
                    <label for="cep" class="block text-sm font-medium text-gray-700">CEP</label>
                    <input type="text" v-model="cliente.cep" @change="cepAlterado" v-maska="'##.###-###'" name="cep" id="cep" autocomplete="email" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                    <div class="text-red-500" v-if="mapErro.cep">{{mapErro.cep}}</div>
                  </div>

                  <div class="col-span-6 sm:col-span-2">
                    <button type="button" @click="pesquisar" class="inline-flex mt-0 sm:mt-6 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      Pesquisar
                    </button>
                  </div>

                  <div class="col-span-6 sm:col-span-6 lg:col-span-4">
                    <label for="address" class="block text-sm font-medium text-gray-700">Endereço</label>
                    <input type="text" v-model="cliente.address" readonly name="address" id="address" autocomplete="address" class="mt-1 bg-gray-200 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  </div>

                  <div class="col-span-6 sm:col-span-6 lg:col-span-2">
                    <label for="numero" class="block text-sm font-medium text-gray-700">Número</label>
                    <input type="text" v-model="cliente.number" name="numero" id="numero" autocomplete="address-level2" class="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                    <p v-if="mapErro.number" class="text-red-500">{{mapErro.number}}</p>
                  </div>

                  <div class="col-span-6 sm:col-span-6 lg:col-span-2">
                    <label for="district" class="block text-sm font-medium text-gray-700">Bairro</label>
                    <input type="text" v-model="cliente.district" readonly name="district" id="district" autocomplete="address-level1" class="mt-1 bg-gray-200  focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  </div>

                  <div class="col-span-6 sm:col-span-6 lg:col-span-2">
                    <label for="city" class="block text-sm font-medium text-gray-700">City</label>
                    <input type="text" v-model="cliente.city" readonly name="city" id="city" autocomplete="address-level2" class="mt-1 bg-gray-200 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  </div>

                  <div class="col-span-6 sm:col-span-6 lg:col-span-2">
                    <label for="state" class="block text-sm font-medium text-gray-700">Estado</label>
                    <input type="text" v-model="cliente.state" readonly name="state" id="state" autocomplete="state" class="mt-1  bg-gray-200 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                  </div>
                  <div class="col-span-6 sm:col-span-6 lg:col-span-2">
                    <label for="state" class="block text-sm font-medium text-gray-700">Ativo?</label>
                    <Switch v-model="cliente.active" :class="[cliente.active ? 'bg-indigo-600' : 'bg-gray-200', 'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500']">
                      <span class="sr-only">Use setting</span>
                      <span aria-hidden="true" :class="[cliente.active ? 'translate-x-5' : 'translate-x-0', 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200']" />
                    </Switch>
                  </div>
                  <div class="col-span-6 sm:col-span-6 lg:col-span-2">
                    <label for="state" class="block text-sm font-medium text-gray-700">Entrada Automática?</label>
                    <Switch v-model="cliente.entrada_automatica" :class="[cliente.entrada_automatica ? 'bg-indigo-600' : 'bg-gray-200', 'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500']">
                      <span class="sr-only">Use setting</span>
                      <span aria-hidden="true" :class="[cliente.entrada_automatica ? 'translate-x-5' : 'translate-x-0', 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200']" />
                    </Switch>
                  </div>
                  <div class="col-span-6 sm:col-span-6 lg:col-span-2">
                    <label for="state" class="block text-sm font-medium text-gray-700">Alarme?</label>
                    <Switch v-model="cliente.tocar_alarme" :class="[cliente.tocar_alarme ? 'bg-indigo-600' : 'bg-gray-200', 'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500']">
                      <span class="sr-only">Use setting</span>
                      <span aria-hidden="true" :class="[cliente.tocar_alarme ? 'translate-x-5' : 'translate-x-0', 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200']" />
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
          </form>
        </div>
      </div>
    </div>
  </Main>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { notify } from "notiwind"
import { Switch, Listbox, ListboxButton, ListboxLabel, ListboxOption, ListboxOptions } from '@headlessui/vue'
import { CheckIcon, SelectorIcon } from '@heroicons/vue/solid'

import { cpf, cnpj } from 'cpf-cnpj-validator';

import Main from '../layout/Main.vue'

import useLogin from '../../composables/useLogin'

import { inserirCliente, obterCliente, atualizarCliente, pesquisarCep } from '../../database/dbClientes';

export default {
  components: {
    Main,
    Switch,
    Listbox,
    ListboxButton,
    ListboxLabel,
    ListboxOption,
    ListboxOptions,
    CheckIcon,
    SelectorIcon,},
  setup() {
    const route = useRoute();
    const router = useRouter();

    const titulo = ref("Novo Cliente")
    const cliente = ref({})
    const mapErro = ref({})

    onMounted(async () => {
      const id = route.params.id;
      if (id) {
        titulo.value = "Editando Cliente"
        cliente.value = await obterCliente(useLogin.state.auth.token, id)
      }
    });

    const cepAlterado = async (e) => {
      cliente.value.address = ""
      cliente.value.district = ""
      cliente.value.city = ""
      cliente.value.state = ""
    }

    const pesquisar = async () => {
      mapErro.value.cep = ""
      const info = await pesquisarCep(cliente.value.cep)
      console.log('info: ', info)
      if (!info) {
        mapErro.value.cep = "Não foi possível encontrar endereço com o CEP informado"
      } else {
        cliente.value.address = info.address
        cliente.value.district = info.district
        cliente.value.city = info.city
        cliente.value.state = info.state
      }
    }

    const salvar =  async () => {
      if (!cliente.value.active) {
        cliente.value.active=false
      }
      if (!validar(cliente.value, mapErro)) {
        try {
          if (cliente.value.id) {
            await atualizarCliente(useLogin.state.auth.token, cliente.value)
          } else {
            console.log("Cliente: ", cliente.value)
            await inserirCliente(useLogin.state.auth.token, cliente.value)
          }
          notify({
            group: "success",
            title: "Sucesso",
            text: "Cliente foi salvo com sucesso!"
          }, 4000)
          router.replace('/clientes');
        } catch (error) {
          console.log("ERRO salvando cliente", error)
          notify({
            group: "error",
            title: "Error",
            text: "Erro salvando cliente!"
          }, 4000)
        }
        await store.dispatch("carregarClientes", store.state.auth.token)
      }
    }
    const cancelar = () => {
      router.replace('/clientes');
    }

    return {
      titulo,
      cliente,
      cepAlterado,
      pesquisar,
      mapErro,
      salvar,
      cancelar
    }
  },
}

const validar = (cliente, mapErro) => {
  let erro=false;
  if (!cliente.name) {
    mapErro.value.name = "Informe o nome"
    erro = true;
  } else {
    mapErro.value.name = ""
  }

  if (!cliente.type) {
    mapErro.value.type = "Informe o tipo de pessoa"
    erro = true;
  } else {
    mapErro.value.type = ""
  }

  if (!cliente.cpfCnpj) {
    mapErro.value.cpfCnpj = "Informe o CPF/CNPJ"
    erro = true;
  } else {
    if (cliente.type==="PF" && !cpf.isValid(cliente.cpfCnpj)) {
      mapErro.value.cpfCnpj = "O CPF informado não é válido"
      erro = true;
    } else if (cliente.type==="PJ" && !cnpj.isValid(cliente.cpfCnpj)) {
      mapErro.value.cpfCnpj = "O CNPJ informado não é válido"
      erro = true;
    } else {
      mapErro.value.cpfCnpj = ""
    }
  }


  if (!cliente.address) {
    mapErro.value.cep = "Pesquise um CEP válido"
    erro = true;
  } else {
    mapErro.value.cep = ""
  }

  if (!cliente.number || !cliente.number.trim()) {
    mapErro.value.number = "Informe o número"
    erro = true;
  } else {
    mapErro.value.number = ""
  }

  return erro;
}


</script>

<style>
</style>
