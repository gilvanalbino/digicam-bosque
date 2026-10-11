<template>
  <!-- Confirmação de associação -->
  <ModalDialog :show="showModalAssociar">
    <h3 class="text-lg font-bold text-gray-900">Confirmar associação</h3>
    <p class="mt-1 text-sm text-gray-500">A saída será registrada na entrada abaixo, como no casamento automático de placas.</p>
    <div v-if="par.entrada && par.saida" class="mt-4 grid grid-cols-2 gap-4">
      <div>
        <p class="text-xs font-bold uppercase text-green-700">Entrada</p>
        <img v-if="par.entrada.imagem && !imagemIndisponivel.entrada" class="mt-1 rounded-lg" :src="`/images${par.entrada.imagem}`" alt=""
            @error="imagemIndisponivel.entrada = true" />
        <div v-else class="mt-1 h-24 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">Sem imagem</div>
        <p class="mt-1 text-lg font-bold text-gray-900">{{ par.entrada.placa }}</p>
        <p class="text-sm text-gray-600">{{ formatarData(par.entrada.dataEntrada) }}</p>
      </div>
      <div>
        <p class="text-xs font-bold uppercase text-red-700">Saída</p>
        <img v-if="par.saida.imagem_carro && !imagemIndisponivel.saida" class="mt-1 rounded-lg" :src="`/images${par.saida.imagem_carro}`" alt=""
            @error="imagemIndisponivel.saida = true" />
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
    <input id="motivo-arquivamento" ref="campoMotivo" type="text" v-model="motivo" maxlength="255"
        @keydown.enter.prevent="confirmarArquivamento"
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

  <!-- Foto da saída -->
  <ModalDialog :show="showModalFoto">
    <p class="text-xs font-bold uppercase text-red-700">Saída</p>
    <p class="text-lg font-bold text-gray-900">{{ saidaFoto.placa }}</p>
    <p class="text-sm text-gray-600">{{ formatarData(saidaFoto.data) }}</p>
    <img v-if="saidaFoto.imagem_carro" class="mt-3 rounded-lg" :src="`/images${saidaFoto.imagem_carro}`" alt="" />
    <img v-if="saidaFoto.imagem_placa" class="mt-3 rounded-lg" :src="`/images${saidaFoto.imagem_placa}`" alt="" />
  </ModalDialog>

  <section aria-labelledby="titulo-saidas-sem-entrada" class="lg:sticky lg:top-4">
    <h3 id="titulo-saidas-sem-entrada" class="text-sm font-medium text-gray-900">
      Saídas sem Entrada Identificada
      <span class="ml-1 py-0.5 px-2 rounded-full text-xs font-medium bg-gray-100 text-gray-900">{{ total }}</span>
    </h3>
    <p class="mt-1 text-xs text-gray-500">
      Arraste uma saída até a entrada correspondente (ou a entrada até a saída), ou selecione a saída e clique em <b>Associar saída</b> no card da entrada.
    </p>
    <p v-if="saidaSelecionada" class="mt-2 text-xs text-indigo-700">
      Saída <b>{{ saidaSelecionada.placa }}</b> selecionada.
      <a href="#" class="text-gray-500 underline" @click.prevent="limparSelecao">Limpar seleção</a>
    </p>

    <div v-if="saidas.length===0" class="mt-2 text-sky-500">Nenhuma saída pendente</div>
    <div v-else class="mt-3 grid grid-cols-1 gap-3 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:p-1">
      <div v-for="saida in saidas" :key="saida.id"
          draggable="true"
          @dragstart="iniciarArraste($event, saida)"
          @dragend="finalizarArraste"
          @dragover="permitirSoltarEntrada($event, saida)"
          @dragleave="sairDoAlvo(saida)"
          @drop.prevent="soltarEntrada(saida)"
          :title="saidaAnteriorAEntrada(saida) ? 'Saída anterior à entrada: não pode ser associada' : null"
          @click="selecionar(saida)"
          class="cursor-grab relative rounded-lg border px-2 py-2 shadow-sm flex items-center space-x-3 hover:border-gray-400"
          :class="[entradasParecidas[saida.id] ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-300',
                   (saidaSelecionada && saidaSelecionada.id === saida.id) || alvoId === saida.id ? 'ring-4 ring-indigo-500 border-indigo-500'
                     : placaParecida(saida) ? 'ring-2 ring-amber-400 border-amber-400' : '',
                   arrastando && arrastando.id === saida.id ? 'opacity-50' : '',
                   saidaAnteriorAEntrada(saida) ? 'opacity-40' : '']">
        <div class="flex-shrink-0">
          <img v-if="saida.imagem_carro_thumb" class="h-14 w-14 rounded-lg cursor-zoom-in" :src="`/images${saida.imagem_carro_thumb}`"
              alt="Ver foto da saída" title="Ver foto" draggable="false" @click.stop="abrirFoto(saida)" />
          <div v-else class="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">sem foto</div>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-lg font-bold text-gray-900">{{ saida.placa }}</p>
          <p class="text-xs text-red-700 font-bold truncate">
            Saída: {{ saida.Camera && mapPortaria[saida.Camera.portaria_id] ? mapPortaria[saida.Camera.portaria_id].nome : '' }}
          </p>
          <p class="text-xs text-red-700 truncate">{{ formatarData(saida.data) }}</p>
          <p v-if="entradasParecidas[saida.id]" class="text-xs font-medium text-blue-800 truncate">
            Parecida com: {{ entradasParecidas[saida.id].join(', ') }}
          </p>
          <button type="button" @click.stop="abrirArquivamento(saida)"
              class="mt-1 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-gray-500 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
            Arquivar
          </button>
        </div>
      </div>
    </div>
    <p v-if="total > saidas.length" class="mt-2 text-xs text-gray-500">
      Exibindo as {{ saidas.length }} saídas mais recentes de {{ total }}.
    </p>
  </section>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { notify } from 'notiwind';

import usePortarias from '../composables/usePortarias';
import useTrafegos from '../composables/useTrafegos';
import useSaidasNaoIdentificadas, { podeAssociar } from '../composables/useSaidasNaoIdentificadas';

import { formatarData } from '../utils/dateUtil';
import { diferencasPlacas as diferencas } from '../utils/placaUtil';

import ModalDialog from './ModalDialog.vue';

export default {
  components: { ModalDialog },
  setup() {
    const mapPortaria = computed(() => usePortarias.state.portarias.map);

    const saidas = computed(() => useSaidasNaoIdentificadas.state.saidas.lista);
    const total = computed(() => useSaidasNaoIdentificadas.state.saidas.total);
    const saidaSelecionada = computed(() => useSaidasNaoIdentificadas.state.interacao.selecionada);
    const arrastando = computed(() => useSaidasNaoIdentificadas.state.interacao.arrastando);

    // saídas com placa próxima da de algum veículo em travessia (que entrou antes dela): o card fica azul
    // e lista as placas parecidas, para ajudar o operador na associação
    const entradasParecidas = computed(() => {
      const mapa = {};
      for (const saida of saidas.value) {
        const placas = useTrafegos.state.trafegos.lista
          .filter((entrada) => podeAssociar(entrada, saida) && diferencas(entrada.placa, saida.placa) <= 2)
          .map((entrada) => entrada.placa);
        if (placas.length > 0) {
          mapa[saida.id] = placas;
        }
      }
      return mapa;
    });

    onMounted(() => {
      useSaidasNaoIdentificadas.actions.ativar().catch((error) => console.log('Erro carregando saídas não identificadas', error));
    });

    onUnmounted(() => {
      useSaidasNaoIdentificadas.actions.desativar();
    });

    const selecionar = (saida) => {
      useSaidasNaoIdentificadas.actions.selecionar(saida);
    };

    const limparSelecao = () => {
      useSaidasNaoIdentificadas.actions.limparSelecao();
    };

    // ---------- arrastar (HTML5): a saída é solta sobre um card de entrada, nas abas ao lado
    const iniciarArraste = (event, saida) => {
      // "move" e não "link": o Wayland não tem a ação de link e o navegador recusa o drop
      event.dataTransfer.effectAllowed = 'move';
      // necessário para o Firefox iniciar o arraste
      event.dataTransfer.setData('text/plain', `saida:${saida.id}`);
      // o estado muda depois do dragstart: alterar a tela durante o evento faz o Chrome cancelar o arraste
      setTimeout(() => useSaidasNaoIdentificadas.actions.iniciarArraste(saida), 0);
    };

    const finalizarArraste = () => {
      useSaidasNaoIdentificadas.actions.finalizarArraste();
    };

    // ---------- sentido inverso: uma entrada arrastada das listas é solta sobre o card da saída
    const entradaArrastada = computed(() => useSaidasNaoIdentificadas.state.interacao.entradaArrastada);
    const alvoId = ref(null);

    const saidaAnteriorAEntrada = (saida) => !!entradaArrastada.value && !podeAssociar(entradaArrastada.value, saida);

    // destaca as saídas com placa parecida com a da entrada arrastada
    const placaParecida = (saida) =>
      podeAssociar(entradaArrastada.value, saida) && diferencas(entradaArrastada.value.placa, saida.placa) <= 2;

    const permitirSoltarEntrada = (event, saida) => {
      if (podeAssociar(entradaArrastada.value, saida)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        alvoId.value = saida.id;
      }
    };

    const sairDoAlvo = (saida) => {
      if (alvoId.value === saida.id) {
        alvoId.value = null;
      }
    };

    const soltarEntrada = (saida) => {
      const entrada = entradaArrastada.value;
      alvoId.value = null;
      if (podeAssociar(entrada, saida)) {
        useSaidasNaoIdentificadas.actions.finalizarArrasteEntrada();
        useSaidasNaoIdentificadas.actions.pedirAssociacao(entrada, saida);
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
    // imagem que não carregou (arquivo ausente) dá lugar ao aviso "Sem imagem"
    const imagemIndisponivel = ref({ entrada: false, saida: false });
    const showModalAssociar = ref(false);

    // pedido vindo de um card de entrada (saída solta sobre ele ou botão "Associar saída")
    watch(
      () => useSaidasNaoIdentificadas.state.interacao.pedido,
      (pedido) => {
        if (pedido) {
          par.value = { entrada: pedido.entrada, saida: pedido.saida };
          imagemIndisponivel.value = { entrada: false, saida: false };
          abrirModal(showModalAssociar);
        }
      }
    );

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

    const saidaFoto = ref({});
    const showModalFoto = ref(false);
    const abrirFoto = (saida) => {
      saidaFoto.value = saida;
      abrirModal(showModalFoto);
    };

    const saidaArquivar = ref({});
    const motivo = ref('');
    const showModalArquivar = ref(false);
    const campoMotivo = ref(null);
    const abrirArquivamento = (saida) => {
      saidaArquivar.value = saida;
      motivo.value = '';
      abrirModal(showModalArquivar);
      focarCampoMotivo();
    };

    // o campo só existe depois que a janela termina de abrir: tenta por até 1 s
    const focarCampoMotivo = (tentativas = 10) => {
      setTimeout(() => {
        if (campoMotivo.value) {
          campoMotivo.value.focus();
        } else if (tentativas > 1) {
          focarCampoMotivo(tentativas - 1);
        }
      }, 100);
    };

    const confirmarArquivamento = async () => {
      // evita arquivar duas vezes com Enter repetido
      if (processando.value) return;
      processando.value = true;
      try {
        await useSaidasNaoIdentificadas.actions.arquivar(saidaArquivar.value.id, motivo.value);
        notify({ group: 'success', title: 'Sucesso', text: `Saída ${saidaArquivar.value.placa} arquivada` }, 4000);
      } catch (error) {
        notify({ group: 'error', title: 'Erro', text: error.message || 'Erro arquivando a saída' }, 4000);
      } finally {
        processando.value = false;
        showModalArquivar.value = false;
      }
    };

    return {
      mapPortaria,
      saidas,
      total,
      entradasParecidas,
      saidaSelecionada,
      arrastando,
      selecionar,
      limparSelecao,
      iniciarArraste,
      finalizarArraste,
      alvoId,
      saidaAnteriorAEntrada,
      placaParecida,
      permitirSoltarEntrada,
      sairDoAlvo,
      soltarEntrada,
      processando,
      par,
      imagemIndisponivel,
      showModalAssociar,
      confirmarAssociacao,
      saidaFoto,
      showModalFoto,
      abrirFoto,
      saidaArquivar,
      campoMotivo,
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
