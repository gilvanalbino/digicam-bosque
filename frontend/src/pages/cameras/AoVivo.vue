<template>
  <Main titulo="Câmeras ao vivo" menu="Câmeras ao vivo">
    <hr class="mt-5 mb-5 bg-gray-400"/>
    <p class="text-sm text-gray-500 mb-4">Clique em uma câmera para ver em tela cheia.</p>

    <div>
      <p v-if="erro" class="text-sm text-red-600">{{ erro }}</p>
      <p v-else-if="carregando" class="text-sm text-gray-500">Carregando câmeras…</p>
      <p v-else-if="cameras.length === 0" class="text-sm text-gray-500">Nenhuma câmera cadastrada para este cliente.</p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          v-for="camera in cameras"
          :key="camera.id"
          class="bg-black rounded-lg overflow-hidden shadow cursor-pointer"
          @click="ampliada = camera"
        >
          <div class="flex items-center justify-between px-3 py-1.5 bg-gray-800 text-white text-sm">
            <span class="font-medium">{{ camera.nome }}</span>
            <span class="text-xs text-gray-300">{{ camera.sentido === 'E' ? 'Entrada' : 'Saída' }}</span>
          </div>
          <div class="aspect-video" :ref="(el) => montar(el, `cam${camera.id}`)" />
        </div>
      </div>
    </div>

    <!-- tela cheia: o mesmo fluxo leve do mosaico, ampliado (banda mínima, sem processamento no servidor). Fica no body para não depender do layout em volta e
         começa abaixo da faixa de homologação, que fica por cima de tudo -->
    <Teleport to="body">
      <div
        v-if="ampliada"
        class="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-black"
        style="top: var(--faixa-ambiente, 0px)"
        @click.self="fechar"
      >
        <div class="flex flex-shrink-0 items-center justify-between gap-4 px-4 py-3 bg-gray-900 text-white">
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 font-medium"
            @click="fechar"
          >
            <span aria-hidden="true">←</span> Voltar às câmeras
          </button>
          <span class="font-medium truncate">{{ ampliada.nome }}</span>
          <span class="hidden sm:inline text-xs text-gray-400">Esc também volta</span>
        </div>
        <div class="flex-1 min-h-0 p-2 overflow-hidden" :ref="(el) => montar(el, `cam${ampliada.id}`)" />
      </div>
    </Teleport>
  </Main>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import useClientes from '../../composables/useClientes';
import { montarVideo, listarCamerasAoVivo } from '../../composables/useVideoAoVivo';
import Main from '../layout/Main.vue';

const cameras = ref([]);
const carregando = ref(true);
const erro = ref('');
const ampliada = ref(null);

// sem controles nem pausa (o clique no mosaico é tratado pelo quadro em volta do vídeo); o Vue chama com null
// quando o elemento sai da tela, e o player fecha a conexão
const montar = (el, fluxo) => {
  if (!el || el.dataset.fluxo === fluxo) {
    return;
  }
  el.dataset.fluxo = fluxo;
  montarVideo(el, fluxo, { interativo: false }).catch(() => {
    erro.value = 'Não foi possível carregar o player de vídeo.';
  });
};

const fechar = () => {
  ampliada.value = null;
};
const teclaEsc = (evento) => {
  if (evento.key === 'Escape') {
    fechar();
  }
};
onBeforeUnmount(() => window.removeEventListener('keydown', teclaEsc));

onMounted(async () => {
  window.addEventListener('keydown', teclaEsc);
  const cliente = useClientes.state.clientes.selecionado;
  try {
    cameras.value = await listarCamerasAoVivo(cliente && cliente.id);
  } catch (e) {
    erro.value = 'Erro ao listar as câmeras.';
  } finally {
    carregando.value = false;
  }
});
</script>
