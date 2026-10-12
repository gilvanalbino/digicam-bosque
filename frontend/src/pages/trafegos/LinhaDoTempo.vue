<template>
  <!-- Fotos da entrada e da saída -->
  <ModalDialog :show="showModal" larga>
    <div class="grid gap-4" :class="detalhe.entrada && detalhe.saida ? 'grid-cols-2' : 'grid-cols-1'">
      <div v-for="lado in [detalhe.entrada, detalhe.saida].filter(Boolean)" :key="lado.titulo">
        <p class="text-xs font-bold uppercase" :class="lado.titulo === 'Entrada' ? 'text-green-700' : 'text-red-700'">{{ lado.titulo }}</p>
        <img v-if="lado.foto" class="mt-1 rounded-lg" :src="`/images${lado.foto}`" alt="" />
        <div v-else class="mt-1 h-24 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">Sem imagem</div>
        <img v-if="lado.fotoPlaca" class="mt-2 h-20 rounded-lg" :src="`/images${lado.fotoPlaca}`" alt="" />
        <p class="mt-1 text-lg font-bold text-gray-900">{{ lado.placa }}</p>
        <p class="text-sm text-gray-600">{{ formatarData(lado.quando) }} {{ lado.portaria }}</p>
      </div>
    </div>
  </ModalDialog>

  <!-- Voltar ao início da página -->
  <button v-if="mostrarVoltarAoInicio" type="button" @click="voltarAoInicio" title="Voltar ao início da página"
      class="fixed bottom-6 right-6 z-10 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
    <span aria-hidden="true">↑</span> Início
  </button>

  <Main titulo="Linha do Tempo" menu="Linha do Tempo">
    <hr class="mt-5 mb-5 bg-gray-400"/>

    <!-- Resumo e filtros -->
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div>
        <label for="linha-dia" class="block text-xs font-medium text-gray-500">Dia</label>
        <input id="linha-dia" type="date" v-model="dia" :max="hoje()"
            class="mt-1 block rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500" />
      </div>
      <div>
        <label for="linha-placa" class="block text-xs font-medium text-gray-500">Placa</label>
        <input id="linha-placa" type="text" v-model="placa" v-maska="'XXXXXXX'" placeholder="Buscar placa"
            class="mt-1 block w-40 uppercase rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500" />
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-for="opcao in filtros" :key="opcao.id" type="button" @click="filtro = opcao.id"
            :class="[filtro === opcao.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50',
                     'inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-300 text-xs font-medium']">
          {{ opcao.titulo }}
          <span :class="[filtro === opcao.id ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-900', 'py-0.5 px-2 rounded-full']">{{ opcao.total }}</span>
        </button>
      </div>
    </div>

    <!-- Entradas por hora: uma barra para cada hora do dia; o clique leva ao início daquela hora na linha do tempo -->
    <section class="mt-6" aria-labelledby="titulo-entradas-por-hora">
      <h3 id="titulo-entradas-por-hora" class="text-sm font-medium text-gray-900">
        Entradas por hora
        <span class="ml-1 py-0.5 px-2 rounded-full text-xs font-medium bg-gray-100 text-gray-900">{{ totalEntradas }}</span>
        <span class="ml-2 text-xs font-normal text-gray-500">clique em uma barra para ir ao início daquela hora</span>
      </h3>
      <div class="mt-3 flex h-28 items-stretch gap-0.5 border-b border-gray-300">
        <button v-for="barra in entradasPorHora" :key="barra.hora" type="button" @click="irParaHora(barra.hora)"
            :aria-label="`${barra.rotulo}: ${barra.total} entrada(s). Ir para o início desta hora na linha do tempo`"
            class="group relative flex-1 min-w-0 focus:outline-none">
          <!-- valor: sempre visível na hora de pico; nas demais, ao passar o mouse ou focar -->
          <span class="pointer-events-none absolute inset-x-0 text-center text-xs font-medium text-gray-700"
              :class="barra.pico ? '' : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'"
              :style="{ bottom: `calc(${barra.altura}% + 2px)` }">{{ barra.total }}</span>
          <span class="absolute inset-x-0 bottom-0 rounded-t group-hover:bg-green-700 group-focus:bg-green-700"
              :class="horaSelecionada === barra.hora ? 'bg-green-800' : 'bg-green-600'"
              :style="{ height: `${barra.altura}%`, minHeight: barra.total > 0 ? '2px' : '0' }"></span>
          <!-- dica ao passar o mouse -->
          <span class="pointer-events-none absolute left-1/2 top-0 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block group-focus:block">
            {{ barra.rotulo }} · {{ barra.total }} {{ barra.total === 1 ? 'entrada' : 'entradas' }}
          </span>
        </button>
      </div>
      <div class="mt-1 flex gap-0.5 text-xs text-gray-500">
        <span v-for="barra in entradasPorHora" :key="barra.hora" class="flex-1 min-w-0 text-center">
          {{ barra.hora % 3 === 0 ? String(barra.hora).padStart(2, '0') + 'h' : '' }}
        </span>
      </div>
    </section>

    <div v-if="carregando && linhas.length === 0" class="mt-6 text-sky-500">Carregando...</div>
    <div v-else-if="linhasFiltradas.length === 0" class="mt-6 mb-32 text-sky-500">Nenhum registro neste dia</div>

    <div v-else class="mt-6">
      <p class="mb-3 text-xs text-gray-500">
        Exibindo {{ linhasExibidas.length }} de {{ linhasFiltradas.length }} eventos.
        <a v-if="linhasFiltradas.length > linhasExibidas.length" href="#" class="font-medium text-indigo-600 underline" @click.prevent="mostrarTodos = true">Mostrar todos</a>
      </p>
      <!-- Cabeçalho das duas linhas -->
      <div class="grid grid-cols-[minmax(0,1fr)_1.5rem_7rem_1.5rem_minmax(0,1fr)] items-center">
        <p class="pr-3 text-right text-xs font-bold uppercase text-green-700">Entradas</p>
        <span class="mx-auto h-3 w-3 rounded-full bg-green-600" aria-hidden="true"></span>
        <span></span>
        <span class="mx-auto h-3 w-3 rounded-full bg-red-600" aria-hidden="true"></span>
        <p class="pl-3 text-xs font-bold uppercase text-red-700">Saídas</p>
      </div>

      <template v-for="linha in linhasExibidas" :key="linha.chave">
        <!-- Separador de hora -->
        <div v-if="linha.novaHora" :id="`hora-${linha.chave}`" class="grid scroll-mt-4 grid-cols-[minmax(0,1fr)_1.5rem_7rem_1.5rem_minmax(0,1fr)] items-stretch">
          <span></span>
          <span class="relative"><span class="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-green-300"></span></span>
          <span class="py-2 text-center text-xs font-medium text-gray-400">{{ linha.novaHora }}</span>
          <span class="relative"><span class="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-red-300"></span></span>
          <span></span>
        </div>

        <div :id="`faixa-${linha.chave}`" class="grid scroll-mt-4 grid-cols-[minmax(0,1fr)_1.5rem_7rem_1.5rem_minmax(0,1fr)] items-stretch"
            :class="faixaDestacada === linha.chave ? 'bg-indigo-50 ring-2 ring-indigo-300 rounded-lg' : ''">
          <!-- Informações da entrada, à esquerda da linha de entradas -->
          <div class="flex justify-end py-1 pr-3">
            <div v-if="linha.entrada" class="flex items-center gap-3 rounded-lg border border-gray-300 px-2 py-1 shadow-sm cursor-pointer hover:border-gray-400"
                :class="linha.entrada.greenList ? 'white-list' : 'bg-white'" @click="abrirFotos(linha)">
              <div class="min-w-0 text-right">
                <p class="text-sm font-bold text-gray-900">{{ linha.entrada.placa }}</p>
                <p class="text-xs text-green-700">
                  {{ formatarHora(linha.entrada.quando) }}
                  <span v-if="linha.entrada.dia" class="ml-1 rounded bg-amber-100 px-1 font-medium text-amber-800">{{ linha.entrada.dia }}</span>
                </p>
                <p class="truncate text-xs text-green-700">
                  <span v-if="linha.entrada.baixaManual" class="mr-1 text-gray-400">baixa manual</span>
                  {{ linha.entrada.portaria }}
                </p>
              </div>
              <img v-if="linha.entrada.miniatura" class="h-12 w-12 flex-shrink-0 rounded-lg" :src="`/images${linha.entrada.miniatura}`" alt="Foto da entrada" loading="lazy" />
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
            <div v-if="linha.saida" class="flex items-center gap-3 rounded-lg border border-gray-300 px-2 py-1 shadow-sm cursor-pointer hover:border-gray-400"
                :class="linha.saida.greenList ? 'white-list' : linha.saida.arquivada ? 'bg-gray-100' : 'bg-white'" @click="abrirFotos(linha)">
              <img v-if="linha.saida.miniatura" class="h-12 w-12 flex-shrink-0 rounded-lg" :src="`/images${linha.saida.miniatura}`" alt="Foto da saída" loading="lazy" />
              <div v-else class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">sem foto</div>
              <div class="min-w-0">
                <p class="text-sm font-bold text-gray-900">{{ linha.saida.placa }}</p>
                <p class="text-xs text-red-700">
                  {{ formatarHora(linha.saida.quando) }}
                  <span v-if="linha.saida.dia" class="ml-1 rounded bg-amber-100 px-1 font-medium text-amber-800">{{ linha.saida.dia }}</span>
                </p>
                <p class="truncate text-xs text-red-700">
                  {{ linha.saida.portaria }}
                  <span v-if="linha.saida.registro" class="ml-1 text-gray-400">{{ linha.saida.registro }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-if="linhasFiltradas.length > linhasExibidas.length" class="mt-4 mb-10 text-center">
        <button type="button" @click="limite += PASSO"
            class="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
          Mostrar mais {{ PASSO }}
        </button>
        <button type="button" @click="mostrarTodos = true"
            class="ml-2 px-4 py-2 rounded-md border border-transparent bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700">
          Mostrar todos ({{ linhasFiltradas.length - linhasExibidas.length }} restantes)
        </button>
      </div>
    </div>
  </Main>
</template>

<script>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { notify } from 'notiwind';

import Main from '../layout/Main.vue';
import ModalDialog from '../../components/ModalDialog.vue';

import useLogin from '../../composables/useLogin';
import useClientes from '../../composables/useClientes';
import usePortarias from '../../composables/usePortarias';

import { obterLinhaDoTempo } from '../../database/dbTrafegos';

import { formatarData, formatarHora, calcularPermanencia } from '../../utils/dateUtil';

// faixas exibidas de cada vez; o restante entra com "Mostrar mais"
const PASSO = 150;

// Linha do tempo de um dia, com as entradas à esquerda e as saídas à direita. Cada registro ocupa uma faixa;
// quando o veículo entrou e saiu, os dois pontos são ligados e a permanência aparece na ligação.
export default {
  components: { Main, ModalDialog },
  setup() {
    const hoje = () => {
      const agora = new Date();
      const doisDigitos = (valor) => String(valor).padStart(2, '0');
      return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
    };

    const dia = ref(hoje());
    const placa = ref('');
    const filtro = ref('todos');
    const limite = ref(PASSO);
    // exibe o dia inteiro de uma vez; vale até trocar de dia
    const mostrarTodos = ref(false);
    const carregando = ref(true);
    const trafegos = ref([]);
    const saidasSemEntrada = ref([]);

    const mapPortaria = computed(() => usePortarias.state.portarias.map);
    const nomePortaria = (id) => (mapPortaria.value[id] ? mapPortaria.value[id].nome : '');

    const inicioDoDia = (data) => new Date(new Date(data).setHours(0, 0, 0, 0)).getTime();
    const noDiaSelecionado = (data) => !!data && inicioDoDia(data) === inicioDoDia(`${dia.value}T12:00:00`);

    // sinaliza o evento ocorrido em outro dia: "ontem" ou a data curta (dd/mm)
    const outroDia = (data) => {
      const dias = Math.round((inicioDoDia(`${dia.value}T12:00:00`) - inicioDoDia(data)) / 86400000);
      if (dias === 0) return '';
      if (dias === 1 && dia.value === hoje()) return 'ontem';
      return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    // uma faixa por registro, da mais recente para a mais antiga
    const linhas = computed(() => {
      // saída registrada manualmente (sem leitura de câmera) não entra na linha do tempo: o horário dela é o do
      // registro, não o da passagem. O veículo aparece só com a entrada, se ela for do dia.
      const saidaManual = (trafego) => !!trafego.dataSaida && !trafego.identificador_placa_saida;
      const dosTrafegos = trafegos.value
        .filter((trafego) => !saidaManual(trafego) || noDiaSelecionado(trafego.dataEntrada))
        .map((trafego) => {
        const temSaida = !!trafego.dataSaida && !saidaManual(trafego);
        return {
          chave: `t${trafego.id}`,
          tipo: temSaida ? 'completo' : 'entrada',
          // posição na linha do tempo: o evento mais recente do registro dentro do dia
          quando: temSaida && noDiaSelecionado(trafego.dataSaida) ? trafego.dataSaida : trafego.dataEntrada,
          entrada: {
            placa: trafego.placa,
            quando: trafego.dataEntrada,
            dia: outroDia(trafego.dataEntrada),
            portaria: nomePortaria(trafego.portaria_entrada_id),
            miniatura: trafego.imagem_thumb,
            foto: trafego.imagem,
            fotoPlaca: trafego.imagem_placa,
            greenList: !!trafego.in_whitelist,
            baixaManual: saidaManual(trafego),
          },
          saida: temSaida
            ? {
                placa: trafego.placa_saida || trafego.placa,
                quando: trafego.dataSaida,
                dia: outroDia(trafego.dataSaida),
                portaria: nomePortaria(trafego.portaria_saida_id),
                miniatura: trafego.imagem_saida_thumb,
                foto: trafego.imagem_saida,
                fotoPlaca: trafego.imagem_saida_placa,
                registro: '',
                greenList: !!trafego.in_whitelist,
              }
            : null,
          permanencia: temSaida ? calcularPermanencia(trafego.dataEntrada, trafego.dataSaida) : '',
        };
      });
      const dasSaidas = saidasSemEntrada.value.map((saida) => ({
        chave: `s${saida.id}`,
        tipo: 'saida',
        quando: saida.data,
        entrada: null,
        saida: {
          placa: saida.placa,
          quando: saida.data,
          dia: '',
          portaria: saida.Camera ? nomePortaria(saida.Camera.portaria_id) : '',
          miniatura: saida.imagem_carro_thumb,
          foto: saida.imagem_carro,
          fotoPlaca: saida.imagem_placa,
          registro: saida.status === 'arquivada' ? 'arquivada' : '',
          arquivada: saida.status === 'arquivada',
          greenList: false,
        },
      }));
      return [...dosTrafegos, ...dasSaidas].sort((a, b) => new Date(b.quando) - new Date(a.quando));
    });

    const filtros = computed(() => [
      { id: 'todos', titulo: 'Todos', total: linhas.value.length },
      { id: 'completo', titulo: 'Entrou e saiu', total: linhas.value.filter((l) => l.tipo === 'completo').length },
      { id: 'entrada', titulo: 'Entrada sem saída', total: linhas.value.filter((l) => l.tipo === 'entrada').length },
      { id: 'saida', titulo: 'Saída sem entrada', total: linhas.value.filter((l) => l.tipo === 'saida').length },
    ]);

    // aplica os filtros e marca a primeira faixa de cada hora, para o separador
    const linhasFiltradas = computed(() => {
      const texto = placa.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      let horaAnterior = null;
      return linhas.value
        .filter((linha) => filtro.value === 'todos' || linha.tipo === filtro.value)
        .filter(
          (linha) =>
            !texto ||
            (linha.entrada && linha.entrada.placa.includes(texto)) ||
            (linha.saida && linha.saida.placa.includes(texto))
        )
        .map((linha) => {
          const hora = new Date(linha.quando).getHours();
          const novaHora = hora !== horaAnterior ? `${String(hora).padStart(2, '0')}h` : '';
          horaAnterior = hora;
          return { ...linha, novaHora };
        });
    });

    const linhasExibidas = computed(() =>
      mostrarTodos.value ? linhasFiltradas.value : linhasFiltradas.value.slice(0, limite.value)
    );

    // ---------- gráfico de entradas por hora (as 24 horas do dia selecionado)
    const entradasPorHora = computed(() => {
      const totais = Array(24).fill(0);
      for (const trafego of trafegos.value) {
        if (noDiaSelecionado(trafego.dataEntrada)) {
          totais[new Date(trafego.dataEntrada).getHours()]++;
        }
      }
      const maximo = Math.max(...totais);
      return totais.map((total, hora) => ({
        hora,
        total,
        rotulo: `${String(hora).padStart(2, '0')}h–${String((hora + 1) % 24).padStart(2, '0')}h`,
        // a escala reserva espaço acima da maior barra para o valor
        altura: maximo > 0 ? (total / maximo) * 82 : 0,
        pico: total > 0 && total === maximo && totais.indexOf(maximo) === hora,
      }));
    });
    const totalEntradas = computed(() => entradasPorHora.value.reduce((soma, barra) => soma + barra.total, 0));

    // clique na barra: leva ao início daquela hora. A linha do tempo vai do mais recente para o mais antigo,
    // então o início da hora é o último evento ocorrido a partir de HH:00:00
    const horaSelecionada = ref(null);
    const faixaDestacada = ref(null);
    const irParaHora = async (hora) => {
      // a busca por placa esconderia os eventos da hora: é limpa antes de localizar a posição
      if (placa.value) {
        placa.value = '';
        // espera a lista reagir à limpeza (a troca de filtro volta a exibição ao tamanho inicial)
        await nextTick();
      }
      const inicioDaHora = new Date(`${dia.value}T${String(hora).padStart(2, '0')}:00:00`).getTime();
      let indice = -1;
      linhasFiltradas.value.forEach((linha, i) => {
        if (new Date(linha.quando).getTime() >= inicioDaHora) indice = i;
      });
      horaSelecionada.value = hora;
      if (indice < 0) {
        notify({ group: 'error', title: 'Linha do tempo', text: 'Não há eventos a partir desse horário com os filtros atuais' }, 3000);
        return;
      }
      const linha = linhasFiltradas.value[indice];
      // a faixa pode ainda não estar na tela: amplia o que é exibido até ela
      if (!mostrarTodos.value && indice >= limite.value) {
        limite.value = indice + PASSO;
      }
      await nextTick();
      const alvo = document.getElementById(`faixa-${linha.chave}`);
      if (alvo) {
        alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        faixaDestacada.value = linha.chave;
        setTimeout(() => {
          if (faixaDestacada.value === linha.chave) faixaDestacada.value = null;
        }, 2500);
      }
    };

    // descarta a resposta de uma consulta antiga quando o dia muda durante a atualização
    let sequencia = 0;
    const carregar = async () => {
      const cliente = useClientes.state.clientes.selecionado;
      if (!cliente) return;
      const seq = ++sequencia;
      try {
        const ret = await obterLinhaDoTempo(useLogin.state.auth.token, cliente.id, dia.value);
        if (seq !== sequencia) return;
        trafegos.value = ret.trafegos || [];
        saidasSemEntrada.value = ret.saidasSemEntrada || [];
      } catch (error) {
        console.log('Erro carregando a linha do tempo', error);
      } finally {
        if (seq === sequencia) {
          carregando.value = false;
        }
      }
    };

    watch(dia, () => {
      carregando.value = true;
      trafegos.value = [];
      saidasSemEntrada.value = [];
      limite.value = PASSO;
      carregar();
    });
    watch([filtro, placa], () => {
      limite.value = PASSO;
    });
    watch(dia, () => {
      horaSelecionada.value = null;
      mostrarTodos.value = false;
    });

    // ---------- botão flutuante para voltar ao início, visível depois de rolar a página
    const mostrarVoltarAoInicio = ref(false);
    const aoRolar = () => {
      mostrarVoltarAoInicio.value = window.scrollY > 400;
    };
    const voltarAoInicio = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // só o dia corrente muda sozinho; dias anteriores não precisam de atualização
    let temporizador = null;
    onMounted(() => {
      window.addEventListener('scroll', aoRolar, { passive: true });
      carregar();
      temporizador = setInterval(() => {
        if (dia.value === hoje()) {
          carregar();
        }
      }, 15000);
    });
    onUnmounted(() => {
      window.removeEventListener('scroll', aoRolar);
      clearInterval(temporizador);
    });

    // ---------- fotos (ModalDialog só reabre quando a prop muda)
    const showModal = ref(false);
    const detalhe = ref({ entrada: null, saida: null });
    const abrirFotos = (linha) => {
      detalhe.value = {
        entrada: linha.entrada ? { titulo: 'Entrada', ...linha.entrada } : null,
        saida: linha.saida ? { titulo: 'Saída', ...linha.saida } : null,
      };
      showModal.value = false;
      setTimeout(() => {
        showModal.value = true;
      }, 100);
    };

    return {
      PASSO,
      hoje,
      dia,
      placa,
      filtro,
      filtros,
      limite,
      mostrarTodos,
      carregando,
      linhas,
      linhasFiltradas,
      linhasExibidas,
      entradasPorHora,
      totalEntradas,
      horaSelecionada,
      faixaDestacada,
      irParaHora,
      mostrarVoltarAoInicio,
      voltarAoInicio,
      showModal,
      detalhe,
      abrirFotos,
      formatarData,
      formatarHora,
    };
  },
};
</script>
