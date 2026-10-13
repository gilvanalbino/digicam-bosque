<template>
  <Datepicker v-model="data" :uid="id" locale="pt-BR" :format-locale="ptBR" format="dd/MM/yyyy" placeholder="dd/mm/aaaa"
      :enable-time-picker="false" :max-date="dataMaxima" :clearable="clearable" auto-apply text-input
      class="campo-data" />
</template>

<script>
import { computed } from 'vue';
import { ptBR } from 'date-fns/locale';

// Campo de data sempre em dd/mm/aaaa. O <input type="date"> do navegador segue o idioma do navegador (em inglês
// mostra mm/dd/yyyy), por isso não é usado. O valor trocado com a tela continua sendo o texto "AAAA-MM-DD".
const paraData = (texto) => (texto ? new Date(`${texto}T00:00:00`) : null);
const doisDigitos = (n) => String(n).padStart(2, '0');
const paraTexto = (data) =>
  data instanceof Date && !isNaN(data)
    ? `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`
    : '';

export default {
  props: {
    modelValue: { type: String, default: '' },
    id: { type: String, default: undefined },
    max: { type: String, default: '' },
    clearable: { type: Boolean, default: true },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const data = computed({
      get: () => paraData(props.modelValue),
      set: (valor) => {
        const texto = paraTexto(valor);
        // campo que não pode ficar vazio mantém a data anterior
        if (!texto && !props.clearable) return;
        emit('update:modelValue', texto);
      },
    });
    const dataMaxima = computed(() => paraData(props.max));
    return { data, dataMaxima, ptBR };
  },
};
</script>

<style>
.campo-data {
  width: 9.5rem;
}
.campo-data .dp__input {
  font-size: 0.875rem;
  line-height: 1.25rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  border-color: #d1d5db;
  border-radius: 0.375rem;
}
</style>
