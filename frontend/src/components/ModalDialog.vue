<!-- https://dev.to/alvarosaburido/create-modals-with-vue3-teleport-tailwindcss-48aj -->
<template>
  <teleport to="body">
    <transition
          enter-active-class="transition ease-out duration-200 transform"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition ease-in duration-200 transform"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0">
      <div
        ref="modal-backdrop"
        class="fixed z-10 inset-0 overflow-y-auto bg-black bg-opacity-50"
        v-if="showModal"
      >
        <div
          class="flex items-start justify-center min-h-screen pt-24 text-center"
        >
          <div
            class="bg-white rounded-lg text-left overflow-hidden shadow-xl p-8"
            :class="larga ? 'w-3/4 max-w-6xl' : 'w-1/2'"
            role="dialog"
            ref="modal"
            aria-modal="true"
            aria-labelledby="modal-headline"
          >
            <!-- <button class="absolute top-4 right-4">
              <icon-close @click="closeModal" />
            </button> -->
                <slot>I'm empty inside</slot>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script>

import { ref, watch, onMounted, onUnmounted } from 'vue';

import useClickOutside from '../composables/useClickOutside';

// Enquanto houver janela aberta, a página de trás não rola. O contador cobre mais de uma janela aberta.
let janelasAbertas = 0;

const travarRolagemDaPagina = (travar) => {
  janelasAbertas = Math.max(0, janelasAbertas + (travar ? 1 : -1));
  const raiz = document.documentElement;
  if (janelasAbertas > 0) {
    // compensa a largura da barra de rolagem que some, para o conteúdo não deslocar
    const larguraBarra = window.innerWidth - raiz.clientWidth;
    raiz.style.overflow = 'hidden';
    raiz.style.paddingRight = larguraBarra > 0 ? `${larguraBarra}px` : '';
  } else {
    raiz.style.overflow = '';
    raiz.style.paddingRight = '';
  }
};

const props = {
  show: {
    type: Boolean,
    default: false,
  },
  // janela mais larga, para conteúdos com imagens lado a lado
  larga: {
    type: Boolean,
    default: false,
  },
};
export default {
  name: 'ModalDialog',
  props,
  setup(props) {
    const showModal = ref(false);
    const { onClickOutside } = useClickOutside();

    const modal = ref(null);
    function closeModal() {
      showModal.value = false;
    }

    onClickOutside(modal, () => {
      if (showModal.value === true) {
        closeModal();
      }
    });

    // fecha com a tecla ESC, como no clique fora do diálogo
    const fecharComEsc = (event) => {
      if (event.key === 'Escape' && showModal.value === true) {
        closeModal();
      }
    };
    onMounted(() => window.addEventListener('keydown', fecharComEsc));
    onUnmounted(() => {
      window.removeEventListener('keydown', fecharComEsc);
      if (showModal.value) {
        travarRolagemDaPagina(false);
      }
    });

    watch(showModal, (aberta, estavaAberta) => {
      if (aberta !== estavaAberta) {
        travarRolagemDaPagina(aberta);
      }
    });

    watch(
      () => props.show,
      show => {
        showModal.value = show;
      },
    );

    return {
      closeModal,
      showModal,
      modal
    };
  }
};
</script>
