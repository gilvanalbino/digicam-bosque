<template>
  <nav v-if="totalPaginas > 1" class="mt-4 flex items-center justify-between border-t border-gray-200 pt-3" aria-label="Paginação">
    <p class="text-sm text-gray-500">
      {{ inicio }}–{{ fim }} de {{ total }}
    </p>
    <div class="flex gap-2">
      <button type="button" :disabled="page <= 1" @click="$emit('change', page - 1)"
          class="px-3 py-1 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
        Anterior
      </button>
      <span class="px-2 py-1 text-sm text-gray-700">Página {{ page }} de {{ totalPaginas }}</span>
      <button type="button" :disabled="page >= totalPaginas" @click="$emit('change', page + 1)"
          class="px-3 py-1 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
        Próxima
      </button>
    </div>
  </nav>
</template>

<script>
import { computed } from 'vue';

export default {
  props: {
    page: { type: Number, required: true },
    total: { type: Number, required: true },
    pageSize: { type: Number, default: 50 },
  },
  emits: ['change'],
  setup(props) {
    const totalPaginas = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
    const inicio = computed(() => (props.page - 1) * props.pageSize + 1);
    const fim = computed(() => Math.min(props.page * props.pageSize, props.total));

    return {
      totalPaginas,
      inicio,
      fim,
    };
  },
};
</script>
