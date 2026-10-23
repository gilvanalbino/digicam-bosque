<template>
  <!-- Câmeras ao vivo na tela de Tráfego: aba pendurada na linha do topo; os vídeos só existem com o painel aberto
       (ao recolher, as conexões fecham; ao abrir de novo, o vídeo volta ao vivo). Sem interação com os vídeos. -->
  <div class="-mt-5 mb-5">
    <div
      v-if="aberto"
      class="bg-gray-900 rounded-b-lg p-2 select-none"
      @contextmenu.prevent
    >
      <p v-if="erro" class="px-2 py-6 text-center text-sm text-red-300">{{ erro }}</p>
      <p v-else-if="carregando" class="px-2 py-6 text-center text-sm text-gray-400">Carregando câmeras…</p>
      <p v-else-if="cameras.length === 0" class="px-2 py-6 text-center text-sm text-gray-400">
        Nenhuma câmera cadastrada para este cliente.
      </p>
      <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-2 pointer-events-none">
        <div v-for="camera in cameras" :key="camera.id" class="relative bg-black rounded overflow-hidden">
          <div class="aspect-video" :ref="(el) => montar(el, camera)" />
          <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black bg-opacity-60 text-white text-xs font-medium">
            {{ nomeCurto(camera) }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex justify-center">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-4 py-1 rounded-b-md bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium shadow"
        :aria-expanded="aberto"
        @click="alternar"
      >
        <VideoCameraIcon class="h-4 w-4" aria-hidden="true" />
        {{ aberto ? 'Ocultar câmeras' : 'Ver câmeras' }}
        <ChevronUpIcon v-if="aberto" class="h-4 w-4" aria-hidden="true" />
        <ChevronDownIcon v-else class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { VideoCameraIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/solid';
import useClientes from '../composables/useClientes';
import { montarVideo, listarCamerasAoVivo, nomeCurto } from '../composables/useVideoAoVivo';

const aberto = ref(false);
const cameras = ref([]);
const carregando = ref(false);
const erro = ref('');
let clienteCarregado = null;

const clienteId = () => useClientes.state.clientes.selecionado && useClientes.state.clientes.selecionado.id;

const carregarCameras = async () => {
  const id = clienteId();
  if (id === clienteCarregado) {
    return;
  }
  carregando.value = true;
  erro.value = '';
  try {
    cameras.value = await listarCamerasAoVivo(id);
    clienteCarregado = id;
  } catch (e) {
    erro.value = 'Erro ao listar as câmeras.';
  } finally {
    carregando.value = false;
  }
};

const alternar = () => {
  aberto.value = !aberto.value;
  if (aberto.value) {
    carregarCameras();
  }
};

// troca de cliente com o painel aberto: recarrega as câmeras
watch(clienteId, () => {
  if (aberto.value) {
    carregarCameras();
  }
});

// fluxo leve (secundário), sem controles nem clique
const montar = (el, camera) => {
  const fluxo = `cam${camera.id}`;
  if (!el || el.dataset.fluxo === fluxo) {
    return;
  }
  el.dataset.fluxo = fluxo;
  montarVideo(el, fluxo, { interativo: false }).catch(() => {
    erro.value = 'Não foi possível carregar o player de vídeo.';
  });
};
</script>
