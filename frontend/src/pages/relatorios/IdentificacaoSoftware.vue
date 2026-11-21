<template>
  <!-- números da identificação por software por câmera (docs/plano_identificacao_placas_software.md, seção 8) -->
  <Main titulo="Identificação por software" menu="Rel. Identificação por software">
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <label class="text-sm text-gray-700">De
        <input type="datetime-local" v-model="inicio" class="mt-1 block border-gray-300 rounded-md shadow-sm sm:text-sm" /></label>
      <label class="text-sm text-gray-700">Até
        <input type="datetime-local" v-model="fim" class="mt-1 block border-gray-300 rounded-md shadow-sm sm:text-sm" /></label>
      <button type="button" @click="carregar" class="py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">Atualizar</button>
    </div>
    <p v-if="erro" class="text-sm text-red-600 mb-3">{{ erro }}</p>
    <div class="overflow-x-auto bg-white shadow sm:rounded-md">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs font-semibold text-gray-600">
          <tr>
            <th class="px-3 py-2">Câmera</th>
            <th class="px-3 py-2 text-right">Passagens</th>
            <th class="px-3 py-2 text-right">Só câmera</th>
            <th class="px-3 py-2 text-right">Só software</th>
            <th class="px-3 py-2 text-right">Os dois</th>
            <th class="px-3 py-2 text-right">Placas divergentes</th>
            <th class="px-3 py-2 text-right">Criadas pelo software</th>
            <th class="px-3 py-2 text-right">Corrigidas depois</th>
            <th class="px-3 py-2 text-right">Sem placa</th>
            <th class="px-3 py-2 text-right">Descartadas</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="l in linhas" :key="l.camera_id">
            <td class="px-3 py-2 font-medium text-gray-900">{{ nomeCamera(l.camera_id) }}</td>
            <td class="px-3 py-2 text-right">{{ l.total }}</td>
            <td class="px-3 py-2 text-right">{{ l.camera }}</td>
            <td class="px-3 py-2 text-right">{{ l.software }}</td>
            <td class="px-3 py-2 text-right">{{ l.ambos }}</td>
            <td class="px-3 py-2 text-right">{{ l.divergentes }}</td>
            <td class="px-3 py-2 text-right">{{ l.criadas_pelo_software }}</td>
            <td class="px-3 py-2 text-right">{{ l.corrigidas }}</td>
            <td class="px-3 py-2 text-right">{{ l.sem_placa }}</td>
            <td class="px-3 py-2 text-right text-gray-500">{{ l.descartadas }}</td>
          </tr>
          <tr v-if="!linhas.length"><td colspan="10" class="px-3 py-6 text-center text-gray-500">Nenhuma passagem no período.</td></tr>
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-gray-500">
      "Só software": passagens que a câmera não leu. "Criadas pelo software": entradas e saídas registradas com a placa
      do software. "Corrigidas depois": a placa do software chegou depois da câmera e substituiu a dela no mesmo
      registro. "Descartadas": o veículo não cruzou a linha (manobra).
    </p>
  </Main>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import dayjs from 'dayjs';
import Main from '../layout/Main.vue';
import useLogin from '../../composables/useLogin';
import useClientes from '../../composables/useClientes';
import { api } from '../../utils/axios';
import { listarCameras } from '../../database/dbCameras';

const inicio = ref(dayjs().subtract(1, 'day').format('YYYY-MM-DDTHH:mm'));
const fim = ref(dayjs().format('YYYY-MM-DDTHH:mm'));
const linhas = ref([]);
const cameras = ref([]);
const erro = ref('');

const clienteId = () => {
  const user = useLogin.state.auth.user;
  return user.admin ? (useClientes.state.clientes.selecionado || {}).id : user.client_id;
};
const nomeCamera = (id) => (cameras.value.find((c) => c.id === id) || {}).nome || `Câmera ${id}`;

const carregar = async () => {
  erro.value = '';
  const id = clienteId();
  if (!id) { erro.value = 'Selecione um cliente.'; return; }
  try {
    const token = useLogin.state.auth.token;
    if (!cameras.value.length) cameras.value = await listarCameras(token, id);
    const r = await api.get(`/identificacoes/client/${id}/resumo`, {
      headers: { authorization: token },
      params: { inicio: dayjs(inicio.value).toISOString(), fim: dayjs(fim.value).toISOString() },
    });
    linhas.value = r.data;
  } catch (e) {
    erro.value = 'Não foi possível carregar o relatório.';
  }
};

onMounted(carregar);
</script>
