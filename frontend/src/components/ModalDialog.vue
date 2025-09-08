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
            class="bg-white rounded-lg text-left overflow-hidden shadow-xl p-8 w-1/2"
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

import { ref, watch } from 'vue';

import useClickOutside from '../composables/useClickOutside';

const props = {
  show: {
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
