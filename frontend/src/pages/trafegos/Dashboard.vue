<template>
  <Main :titulo="titulo" menu="Tráfego">
    <template v-slot:buttons v-if="portariaSelecionada">
        <button type="button" @click="adicionar" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          Identificação Manual
        </button>
    </template>
    <hr class="mt-5 mb-5 bg-gray-400"/>

    <!-- Placas Identificadas -->
    <div>
      <PlacasIdentificadas/>
    </div>
    <hr class="mt-5 mb-5 bg-gray-400"/>

    <!-- Lista de Trafegos -->
    <ListaTrafego/>
  </Main>
</template>

<script>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import Main from '../layout/Main.vue'
import PlacasIdentificadas from '../../components/PlacasIdentificadas.vue';
import ListaTrafego from '../../components/ListaTrafego.vue';

import usePortarias from '../../composables/usePortarias'

export default {
  components: {Main, PlacasIdentificadas, ListaTrafego},
  setup() {

    const portariaSelecionada = computed(() => usePortarias.state.portarias.selecionada);

    const titulo = computed(()=>{
      if (usePortarias.state.portarias.selecionada) {
        return usePortarias.state.portarias.selecionada.nome;
      } else {
        return "Selecione uma portaria";
      }
    })

    const router = useRouter();

    const adicionar = () => {
      router.replace('/trafegos/novo');
    }

    return {
      titulo,
      portariaSelecionada,
      adicionar
    }
  },
}
</script>

<style>
</style>
