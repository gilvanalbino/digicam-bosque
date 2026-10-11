<template>
  <!-- Confirmação de associação -->
  <ModalDialog :show="showModalAssociar">
    <h3 class="text-lg font-bold text-gray-900">Confirmar associação</h3>
    <p class="mt-1 text-sm text-gray-500">A saída será registrada na entrada abaixo, como no casamento automático de placas.</p>
    <div v-if="par.entrada && par.saida" class="mt-4 grid grid-cols-2 gap-4">
      <div>
        <p class="text-xs font-bold uppercase text-green-700">Entrada</p>
        <img class="mt-1 rounded-lg" :src="`/images${par.entrada.imagem}`" alt="" />
        <p class="mt-1 text-lg font-bold text-gray-900">{{ par.entrada.placa }}</p>
        <p class="text-sm text-gray-600">{{ formatarData(par.entrada.dataEntrada) }}</p>
      </div>
      <div>
        <p class="text-xs font-bold uppercase text-red-700">Saída</p>
        <img v-if="par.saida.imagem_carro" class="mt-1 rounded-lg" :src="`/images${par.saida.imagem_carro}`" alt="" />
        <div v-else class="mt-1 h-24 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">Sem imagem</div>
        <p class="mt-1 text-lg font-bold text-gray-900">{{ par.saida.placa }}</p>
        <p class="text-sm text-gray-600">{{ formatarData(par.saida.data) }}</p>
      </div>
    </div>
    <div v-if="par.entrada && par.saida && diferencas(par.entrada.placa, par.saida.placa) > 2" class="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Atenção: as placas diferem em {{ diferencas(par.entrada.placa, par.saida.placa) }} caracteres. Confira as imagens antes de confirmar.
    </div>
    <div class="mt-6 flex justify-end gap-2">
      <button type="button" @click="showModalAssociar = false" class="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50">
        Cancelar
      </button>
      <button type="button" :disabled="processando" @click="confirmarAssociacao" class="px-3 py-2 rounded-md bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        Confirmar associação
      </button>
    </div>
  </ModalDialog>

  <!-- Confirmação de arquivamento -->
  <ModalDialog :show="showModalArquivar">
    <h3 class="text-lg font-bold text-gray-900">Arquivar saída sem entrada</h3>
    <p class="mt-1 text-sm text-gray-500">
      A saída <b>{{ saidaArquivar.placa }}</b> ({{ formatarData(saidaArquivar.data) }}) sai da fila de pendências e não gera registro de tráfego nos relatórios.
    </p>
    <label for="motivo-arquivamento" class="mt-4 block text-xs font-medium text-gray-500">Motivo (opcional)</label>
    <input id="motivo-arquivamento" type="text" v-model="motivo" maxlength="255"
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500" />
    <div class="mt-6 flex justify-end gap-2">
      <button type="button" @click="showModalArquivar = false" class="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50">
        Cancelar
      </button>
      <button type="button" :disabled="processando" @click="confirmarArquivamento" class="px-3 py-2 rounded-md bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
        Arquivar
      </button>
    </div>
  </ModalDialog>

  <p class="text-sm text-gray-500">
    Arraste uma saída até a entrada correspondente (ou o inverso), ou selecione uma de cada lado e clique em <b>Associar</b>.
  </p>
  <div v-if="entradaSelecionada || saidaSelecionada" class="mt-3 flex items-center gap-3">
    <button type="button" :disabled="!entradaSelecionada || !saidaSelecionada" @click="abrirAssociacao(entradaSelecionada, saidaSelecionada)"
        class="px-3 py-2 rounded-md bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">
      Associar {{ entradaSelecionada ? entradaSelecionada.placa : '…' }} ⇄ {{ saidaSelecionada ? saidaSelecionada.placa : '…' }}
    </button>
    <a href="#" class="text-sm text-gray-500 underline" @click.prevent="limparSelecao">Limpar seleção</a>
  </div>

  <div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
    <!-- Entradas sem saída -->
    <section>
      <h3 class="text-sm leading-4 italic font-medium text-gray-500">
        Entradas sem saída (total: {{ entradas.length }})
      </h3>
      <div v-if="entradas.length===0" class="mt-2 text-sky-500">Nenhuma entrada sem saída</div>
      <div v-else class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div v-for="trafego in entradas" :key="trafego.id"
            draggable="true"
            @dragstart="iniciarArraste($event, 'entrada', trafego)"
            @dragend="finalizarArraste"
            @dragover="permitirSoltar($event, 'entrada', trafego)"
            @dragleave="sairDoAlvo('entrada', trafego)"
            @drop.prevent="soltar('entrada', trafego)"
            class="cursor-grab"
            :class="arrastando && arrastando.item.id === trafego.id && arrastando.tipo === 'entrada' ? 'opacity-50' : ''">
          <TrafegoCard :trafego="trafego" :mapPortaria="mapPortaria" :mapMoradores="mapMoradores" compacto
              :destacado="destacado('entrada', trafego)"
              @abrir="selecionar('entrada', trafego)" />
        </div>
      </div>
    </section>

    <!-- Saídas sem entrada identificada -->
    <section>
      <h3 class="text-sm leading-4 italic font-medium text-gray-500">
        Saídas sem entrada identificada (total: {{ saidas.length }})
      </h3>
      <div v-if="saidas.length===0" class="mt-2 text-sky-500">Nenhuma saída pendente</div>
      <div v-else class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div v-for="saida in saidas" :key="saida.id"
            draggable="true"
            @dragstart="iniciarArraste($event, 'saida', saida)"
            @dragend="finalizarArraste"
            @dragover="permitirSoltar($event, 'saida', saida)"
            @dragleave="sairDoAlvo('saida', saida)"
            @drop.prevent="soltar('saida', saida)"
            @click="selecionar('saida', saida)"
            class="cursor-grab relative rounded-lg border border-gray-300 bg-white px-2 py-2 shadow-sm flex items-center space-x-3 hover:border-gray-400"
            :class="[destacado('saida', saida) ? 'ring-4 ring-indigo-500 border-indigo-500' : '',
                     arrastando && arrastando.item.id === saida.id && arrastando.tipo === 'saida' ? 'opacity-50' : '']">
          <div class="flex-shrink-0">
            <img v-if="saida.imagem_carro_thumb" class="h-14 w-14 rounded-lg" :src="`/images${saida.imagem_carro_thumb}`" alt="" draggable="false" />
            <div v-else class="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">sem foto</div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-lg font-bold text-gray-900">{{ saida.placa }}</p>
            <p class="text-xs text-red-700 font-bold truncate">
              Saída: {{ saida.Camera && mapPortaria[saida.Camera.portaria_id] ? mapPortaria[saida.Camera.portaria_id].nome : '' }}
            </p>
            <p class="text-xs text-red-700 truncate">{{ formatarData(saida.data) }}</p>
            <button type="button" @click.stop="abrirArquivamento(saida)"
                class="mt-1 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-gray-500 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
              Arquivar
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { notify } from 'notiwind';

import usePortarias from '../composables/usePortarias';
import useTrafegos from '../composables/useTrafegos';
import useMoradores from '../composables/useMoradores';
import useSaidasNaoIdentificadas from '../composables/useSaidasNaoIdentificadas';

import { formatarData } from '../utils/dateUtil';

import ModalDialog from './ModalDialog.vue';
import TrafegoCard from './TrafegoCard.vue';

// quantidade de posições diferentes entre duas placas (tolerância a erro de OCR)
const diferencas = (placaA = '', placaB = '') => {
  const tamanho = Math.max(placaA.length, placaB.length);
  let diff = 0;
  for (let i = 0; i < tamanho; i++) {
    if (placaA[i] !== placaB[i]) diff++;
  }
  return diff;
};

// ordena pelas placas mais parecidas com a referência, mantendo a ordem original no empate
const ordenarPorSemelhanca = (lista, placaReferencia) => {
  if (!placaReferencia) return lista;
  return lista
    .map((item, indice) => ({ item, indice, diff: diferencas(item.placa, placaReferencia) }))
    .sort((a, b) => a.diff - b.diff || a.indice - b.indice)
    .map(({ item }) => item);
};

export default {
  components: { ModalDialog, TrafegoCard },
  setup() {
    const mapPortaria = computed(() => usePortarias.state.portarias.map);
    const mapMoradores = computed(() => useMoradores.state.moradores.map);

    const entradaSelecionada = ref(null);
    const saidaSelecionada = ref(null);
    const arrastando = ref(null);
    const alvo = ref(null);

    // referência para ordenar a coluna oposta: item selecionado por clique
    // (não reordena durante o arraste, para o card sob o cursor não mudar)
    const referencia = (tipo) => {
      const selecionado = tipo === 'entrada' ? entradaSelecionada.value : saidaSelecionada.value;
      return selecionado ? selecionado.placa : null;
    };

    const entradas = computed(() => ordenarPorSemelhanca(useTrafegos.state.trafegos.semSaida, referencia('saida')));
    const saidas = computed(() => ordenarPorSemelhanca(useSaidasNaoIdentificadas.state.saidas.lista, referencia('entrada')));

    onMounted(() => {
      useTrafegos.actions.carregarSemSaida().catch((error) => console.log('Erro carregando entradas sem saída', error));
      useSaidasNaoIdentificadas.actions.ativar().catch((error) => console.log('Erro carregando saídas não identificadas', error));
    });

    onUnmounted(() => {
      useSaidasNaoIdentificadas.actions.desativar();
    });

    const selecionar = (tipo, item) => {
      const selecionado = tipo === 'entrada' ? entradaSelecionada : saidaSelecionada;
      selecionado.value = selecionado.value && selecionado.value.id === item.id ? null : item;
    };

    const limparSelecao = () => {
      entradaSelecionada.value = null;
      saidaSelecionada.value = null;
    };

    const destacado = (tipo, item) => {
      const selecionado = tipo === 'entrada' ? entradaSelecionada.value : saidaSelecionada.value;
      const ehAlvo = alvo.value && alvo.value.tipo === tipo && alvo.value.item.id === item.id;
      return ehAlvo || (selecionado && selecionado.id === item.id);
    };

    // ---------- arrastar e soltar (HTML5)
    const iniciarArraste = (event, tipo, item) => {
      arrastando.value = { tipo, item };
      event.dataTransfer.effectAllowed = 'link';
      // necessário para o Firefox iniciar o arraste
      event.dataTransfer.setData('text/plain', `${tipo}:${item.id}`);
    };

    const finalizarArraste = () => {
      arrastando.value = null;
      alvo.value = null;
    };

    const permitirSoltar = (event, tipo, item) => {
      // só aceita soltar sobre um card da coluna oposta
      if (arrastando.value && arrastando.value.tipo !== tipo) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'link';
        alvo.value = { tipo, item };
      }
    };

    const sairDoAlvo = (tipo, item) => {
      if (alvo.value && alvo.value.tipo === tipo && alvo.value.item.id === item.id) {
        alvo.value = null;
      }
    };

    const soltar = (tipo, item) => {
      if (!arrastando.value || arrastando.value.tipo === tipo) return;
      const arrastado = arrastando.value.item;
      finalizarArraste();
      if (tipo === 'entrada') {
        abrirAssociacao(item, arrastado);
      } else {
        abrirAssociacao(arrastado, item);
      }
    };

    // ---------- modais (ModalDialog só reabre quando a prop muda)
    const abrirModal = (modal) => {
      modal.value = false;
      setTimeout(() => {
        modal.value = true;
      }, 100);
    };

    const processando = ref(false);

    const par = ref({ entrada: null, saida: null });
    const showModalAssociar = ref(false);
    const abrirAssociacao = (entrada, saida) => {
      par.value = { entrada, saida };
      abrirModal(showModalAssociar);
    };

    const confirmarAssociacao = async () => {
      processando.value = true;
      try {
        await useSaidasNaoIdentificadas.actions.associar(par.value.saida.id, par.value.entrada.id);
        notify({ group: 'success', title: 'Sucesso', text: `Saída associada à entrada ${par.value.entrada.placa}` }, 4000);
        limparSelecao();
      } catch (error) {
        notify({ group: 'error', title: 'Erro', text: error.message || 'Erro associando a saída' }, 4000);
      } finally {
        processando.value = false;
        showModalAssociar.value = false;
      }
    };

    const saidaArquivar = ref({});
    const motivo = ref('');
    const showModalArquivar = ref(false);
    const abrirArquivamento = (saida) => {
      saidaArquivar.value = saida;
      motivo.value = '';
      abrirModal(showModalArquivar);
    };

    const confirmarArquivamento = async () => {
      processando.value = true;
      try {
        await useSaidasNaoIdentificadas.actions.arquivar(saidaArquivar.value.id, motivo.value);
        notify({ group: 'success', title: 'Sucesso', text: `Saída ${saidaArquivar.value.placa} arquivada` }, 4000);
        if (saidaSelecionada.value && saidaSelecionada.value.id === saidaArquivar.value.id) {
          saidaSelecionada.value = null;
        }
      } catch (error) {
        notify({ group: 'error', title: 'Erro', text: error.message || 'Erro arquivando a saída' }, 4000);
      } finally {
        processando.value = false;
        showModalArquivar.value = false;
      }
    };

    return {
      mapPortaria,
      mapMoradores,
      entradas,
      saidas,
      entradaSelecionada,
      saidaSelecionada,
      arrastando,
      selecionar,
      limparSelecao,
      destacado,
      iniciarArraste,
      finalizarArraste,
      permitirSoltar,
      sairDoAlvo,
      soltar,
      processando,
      par,
      showModalAssociar,
      abrirAssociacao,
      confirmarAssociacao,
      saidaArquivar,
      motivo,
      showModalArquivar,
      abrirArquivamento,
      confirmarArquivamento,
      diferencas,
      formatarData,
    };
  },
};
</script>
