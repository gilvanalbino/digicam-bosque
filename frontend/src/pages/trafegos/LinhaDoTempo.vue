<template>
  <Main titulo="Linha do Tempo" menu="Linha do Tempo">
    <hr class="mt-5 mb-5 bg-gray-400"/>

    <!-- Resumo e filtros -->
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <h3 class="text-sm leading-4 italic font-medium text-gray-500">
        Entradas e saídas de hoje ({{ dataDeHoje() }})
      </h3>
      <div class="flex flex-wrap gap-2">
        <button v-for="opcao in filtros" :key="opcao.id" type="button" @click="filtro = opcao.id"
            :class="[filtro === opcao.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50',
                     'inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-300 text-xs font-medium']">
          {{ opcao.titulo }}
          <span :class="[filtro === opcao.id ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-900', 'py-0.5 px-2 rounded-full']">{{ opcao.total }}</span>
        </button>
      </div>
    </div>

    <div v-if="carregando && linhas.length === 0" class="mt-6 text-sky-500">Carregando...</div>
    <div v-else-if="linhasFiltradas.length === 0" class="mt-6 mb-32 text-sky-500">Nenhum registro hoje</div>

    <div v-else class="mt-6">
      <!-- Cabeçalho das duas linhas -->
      <div class="grid grid-cols-[minmax(0,1fr)_1.5rem_7rem_1.5rem_minmax(0,1fr)] items-center">
        <p class="pr-3 text-right text-xs font-bold uppercase text-green-700">Entradas</p>
        <span class="mx-auto h-3 w-3 rounded-full bg-green-600" aria-hidden="true"></span>
        <span></span>
        <span class="mx-auto h-3 w-3 rounded-full bg-red-600" aria-hidden="true"></span>
        <p class="pl-3 text-xs font-bold uppercase text-red-700">Saídas</p>
      </div>

      <template v-for="linha in linhasFiltradas" :key="linha.chave">
        <!-- Separador de hora -->
        <div v-if="linha.novaHora" class="grid grid-cols-[minmax(0,1fr)_1.5rem_7rem_1.5rem_minmax(0,1fr)] items-stretch">
          <span></span>
          <span class="relative"><span class="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-green-300"></span></span>
          <span class="py-2 text-center text-xs font-medium text-gray-400">{{ linha.novaHora }}</span>
          <span class="relative"><span class="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-red-300"></span></span>
          <span></span>
        </div>

        <div class="grid grid-cols-[minmax(0,1fr)_1.5rem_7rem_1.5rem_minmax(0,1fr)] items-stretch">
          <!-- Informações da entrada, à esquerda da linha de entradas -->
          <div class="flex justify-end py-1 pr-3">
            <div v-if="linha.entrada" class="flex items-center gap-3 rounded-lg border border-gray-300 px-2 py-1 shadow-sm"
                :class="linha.entrada.greenList ? 'white-list' : 'bg-white'">
              <div class="min-w-0 text-right">
                <p class="text-sm font-bold text-gray-900">{{ linha.entrada.placa }}</p>
                <p class="text-xs text-green-700">
                  {{ formatarHora(linha.entrada.quando) }}
                  <span v-if="linha.entrada.dia" class="ml-1 rounded bg-amber-100 px-1 font-medium text-amber-800">{{ linha.entrada.dia }}</span>
                </p>
                <p class="truncate text-xs text-green-700">{{ linha.entrada.portaria }}</p>
              </div>
              <img v-if="linha.entrada.miniatura" class="h-12 w-12 flex-shrink-0 rounded-lg" :src="`/images${linha.entrada.miniatura}`" alt="Foto da entrada" />
              <div v-else class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">sem foto</div>
            </div>
          </div>

          <!-- Linha das entradas -->
          <div class="relative">
            <span class="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-green-300"></span>
            <span v-if="linha.entrada" class="absolute left-1/2 top-1/2 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-green-600"></span>
          </div>

          <!-- Ligação entre a entrada e a saída do mesmo veículo -->
          <div class="relative flex items-center justify-center">
            <template v-if="linha.entrada && linha.saida">
              <span class="absolute inset-x-0 top-1/2 -mt-px h-0.5 bg-gray-400"></span>
              <span class="relative rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700" title="Permanência">
                {{ linha.permanencia }}
              </span>
            </template>
          </div>

          <!-- Linha das saídas -->
          <div class="relative">
            <span class="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-red-300"></span>
            <span v-if="linha.saida" class="absolute left-1/2 top-1/2 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-red-600"></span>
          </div>

          <!-- Informações da saída, à direita da linha de saídas -->
          <div class="flex justify-start py-1 pl-3">
            <div v-if="linha.saida" class="flex items-center gap-3 rounded-lg border border-gray-300 px-2 py-1 shadow-sm"
                :class="linha.saida.greenList ? 'white-list' : 'bg-white'">
              <img v-if="linha.saida.miniatura" class="h-12 w-12 flex-shrink-0 rounded-lg" :src="`/images${linha.saida.miniatura}`" alt="Foto da saída" />
              <div v-else class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">sem foto</div>
              <div class="min-w-0">
                <p class="text-sm font-bold text-gray-900">{{ linha.saida.placa }}</p>
                <p class="text-xs text-red-700">{{ formatarHora(linha.saida.quando) }}</p>
                <p class="truncate text-xs text-red-700">
                  {{ linha.saida.portaria }}
                  <span v-if="linha.saida.registro" class="ml-1 text-gray-400">{{ linha.saida.registro }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </Main>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';

import Main from '../layout/Main.vue';

import useLogin from '../../composables/useLogin';
import useClientes from '../../composables/useClientes';
import usePortarias from '../../composables/usePortarias';

import { listarTrafegosPorStatus } from '../../database/dbTrafegos';
import { listarSaidasNaoIdentificadas } from '../../database/dbSaidasNaoIdentificadas';

import { formatarHora, calcularPermanencia } from '../../utils/dateUtil';

// Protótipo: linha do tempo do dia com as entradas à esquerda e as saídas à direita. Cada registro ocupa uma
// faixa; quando o veículo entrou e saiu, os dois pontos são ligados e a permanência aparece na ligação.
export default {
  components: { Main },
  setup() {
    const trafegosComSaida = ref([]);
    const trafegosSemSaida = ref([]);
    const saidasSemEntrada = ref([]);
    const carregando = ref(true);
    const filtro = ref('todos');

    const mapPortaria = computed(() => usePortarias.state.portarias.map);
    const nomePortaria = (id) => (mapPortaria.value[id] ? mapPortaria.value[id].nome : '');

    const dataDeHoje = () => new Date().toLocaleDateString('pt-BR');

    // sinaliza a entrada feita em dia anterior ao da saída: "ontem" ou a data curta (dd/mm)
    const diaDaEntrada = (dataEntrada, dataSaida) => {
      const inicioDoDia = (data) => new Date(new Date(data).setHours(0, 0, 0, 0)).getTime();
      const dias = Math.round((inicioDoDia(dataSaida) - inicioDoDia(dataEntrada)) / 86400000);
      if (dias <= 0) return '';
      if (dias === 1) return 'ontem';
      return new Date(dataEntrada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    const entradaDe = (trafego, dia = '') => ({
      placa: trafego.placa,
      quando: trafego.dataEntrada,
      dia,
      portaria: nomePortaria(trafego.portaria_entrada_id),
      miniatura: trafego.imagem_thumb,
      greenList: !!trafego.in_whitelist,
    });

    // uma faixa por registro, da mais recente para a mais antiga
    const linhas = computed(() => {
      const completas = trafegosComSaida.value.map((trafego) => ({
        chave: `t${trafego.id}`,
        tipo: 'completo',
        quando: trafego.dataSaida,
        entrada: entradaDe(trafego, diaDaEntrada(trafego.dataEntrada, trafego.dataSaida)),
        saida: {
          placa: trafego.placa_saida || trafego.placa,
          quando: trafego.dataSaida,
          portaria: nomePortaria(trafego.portaria_saida_id),
          miniatura: trafego.imagem_saida_thumb,
          registro: trafego.saida_automatica ? '' : 'manual',
          greenList: !!trafego.in_whitelist,
        },
        permanencia: calcularPermanencia(trafego.dataEntrada, trafego.dataSaida),
      }));
      const soEntrada = trafegosSemSaida.value.map((trafego) => ({
        chave: `e${trafego.id}`,
        tipo: 'entrada',
        quando: trafego.dataEntrada,
        entrada: entradaDe(trafego),
        saida: null,
      }));
      const soSaida = saidasSemEntrada.value.map((saida) => ({
        chave: `s${saida.id}`,
        tipo: 'saida',
        quando: saida.data,
        entrada: null,
        saida: {
          placa: saida.placa,
          quando: saida.data,
          portaria: saida.Camera ? nomePortaria(saida.Camera.portaria_id) : '',
          miniatura: saida.imagem_carro_thumb,
          registro: '',
          greenList: !!saida.in_whitelist,
        },
      }));
      return [...completas, ...soEntrada, ...soSaida].sort((a, b) => new Date(b.quando) - new Date(a.quando));
    });

    const filtros = computed(() => [
      { id: 'todos', titulo: 'Todos', total: linhas.value.length },
      { id: 'completo', titulo: 'Entrou e saiu', total: linhas.value.filter((l) => l.tipo === 'completo').length },
      { id: 'entrada', titulo: 'Entrada sem saída', total: linhas.value.filter((l) => l.tipo === 'entrada').length },
      { id: 'saida', titulo: 'Saída sem entrada', total: linhas.value.filter((l) => l.tipo === 'saida').length },
    ]);

    // marca a primeira faixa de cada hora, para o separador
    const linhasFiltradas = computed(() => {
      let horaAnterior = null;
      return linhas.value
        .filter((linha) => filtro.value === 'todos' || linha.tipo === filtro.value)
        .map((linha) => {
          const hora = new Date(linha.quando).getHours();
          const novaHora = hora !== horaAnterior ? `${String(hora).padStart(2, '0')}h` : '';
          horaAnterior = hora;
          return { ...linha, novaHora };
        });
    });

    const carregar = async () => {
      const cliente = useClientes.state.clientes.selecionado;
      if (!cliente) return;
      const token = useLogin.state.auth.token;
      try {
        const [comSaida, semSaida, saidas] = await Promise.all([
          listarTrafegosPorStatus(token, cliente.id, 'saidas', { page: 1, pageSize: 200 }),
          listarTrafegosPorStatus(token, cliente.id, 'sem_saida', { page: 1, pageSize: 200 }),
          listarSaidasNaoIdentificadas(token, cliente.id, { status: 'pendente', page: 1, pageSize: 200 }),
        ]);
        trafegosComSaida.value = comSaida.rows || [];
        trafegosSemSaida.value = semSaida.rows || [];
        saidasSemEntrada.value = saidas.rows || [];
      } catch (error) {
        console.log('Erro carregando a linha do tempo', error);
      } finally {
        carregando.value = false;
      }
    };

    let temporizador = null;
    onMounted(() => {
      carregar();
      temporizador = setInterval(carregar, 10000);
    });
    onUnmounted(() => clearInterval(temporizador));

    return {
      carregando,
      filtro,
      filtros,
      linhas,
      linhasFiltradas,
      dataDeHoje,
      formatarHora,
    };
  },
};
</script>
