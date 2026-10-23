<template>
  <div
    v-if="homologacao"
    class="fixed inset-x-0 top-0 z-[60] flex items-center justify-center h-6 bg-red-600 text-white text-xs font-bold tracking-wide uppercase select-none"
    role="status"
  >
    Versão de homologação — os dados e ações aqui não valem para a portaria
  </div>
</template>

<script setup>
// Faixa vermelha no topo quando o backend informa que roda em homologação (rota /health, campo "ambiente").
// A mesma imagem do frontend vai para HML e produção; a identificação é feita em tempo de execução.
import { ref, onMounted } from 'vue';
import { api } from '../utils/axios';

const ALTURA = '1.5rem'; // h-6
const homologacao = ref(false);

onMounted(async () => {
  try {
    const { data } = await api.get('/health');
    homologacao.value = data && data.ambiente === 'homologacao';
  } catch (e) {
    // health com banco fora do ar responde 503, mas ainda informa o ambiente
    const data = e && e.response && e.response.data;
    homologacao.value = !!data && data.ambiente === 'homologacao';
  }
  // empurra a página e os elementos fixos (menu lateral, cabeçalho) para baixo da faixa
  document.documentElement.style.setProperty('--faixa-ambiente', homologacao.value ? ALTURA : '0px');
});
</script>

<style>
body {
  padding-top: var(--faixa-ambiente, 0px);
}
</style>
