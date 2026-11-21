<template>
  <!-- quem identificou a passagem: câmera, software ou os dois (docs/plano_identificacao_placas_software.md, seção 8) -->
  <span v-if="rotulo" class="inline-flex flex-wrap items-center gap-1 align-middle">
    <span :class="classe" class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
          :title="detalhe">{{ rotulo }}</span>
    <span v-if="outraLeitura" class="text-[11px] text-gray-500" :title="detalhe">{{ outraLeitura }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  identificacao: { type: Object, default: null },
  placa: { type: String, default: '' },
});

const rotulo = computed(() => {
  const i = props.identificacao;
  if (!i) return '';
  if (i.origem === 'software') return 'software';
  if (i.origem === 'ambos') return 'câmera + software';
  return '';
});

const classe = computed(() =>
  props.identificacao && props.identificacao.origem === 'software'
    ? 'bg-indigo-100 text-indigo-700'
    : 'bg-gray-100 text-gray-700'
);

// na divergência, mostra a leitura que não valeu
const outraLeitura = computed(() => {
  const i = props.identificacao;
  if (!i || !i.divergente) return '';
  const outras = [];
  if (i.placa_camera && i.placa_camera !== props.placa) outras.push(`câmera leu ${i.placa_camera}`);
  if (i.placa_software && i.placa_software !== props.placa) outras.push(`software leu ${i.placa_software}`);
  return outras.join(' · ');
});

const detalhe = computed(() => {
  const i = props.identificacao;
  if (!i) return '';
  const partes = [`câmera: ${i.placa_camera || '—'}`, `software: ${i.placa_software || '—'}`];
  if (i.placa_operador) partes.push(`operador: ${i.placa_operador}`);
  return partes.join(' | ');
});
</script>
