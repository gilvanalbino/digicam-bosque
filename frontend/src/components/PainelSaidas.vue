<template>
  <!-- Confirmação de associação -->
  <ModalDialog :show="showModalAssociar" larga>
    <h3 class="text-lg font-bold text-gray-900">Confirmar associação</h3>
    <p class="mt-1 text-sm text-gray-500">A saída será registrada na entrada abaixo, como no casamento automático de placas.</p>
    <div v-if="par.entrada && par.saida" class="mt-4 grid grid-cols-2 gap-4">
      <div>
        <p class="text-xs font-bold uppercase text-green-700">Entrada</p>
        <img v-if="par.entrada.imagem && !imagemIndisponivel.entrada" class="mt-1 rounded-lg" :src="`/images${par.entrada.imagem}`" alt=""
            @error="imagemIndisponivel.entrada = true" />
        <div v-else class="mt-1 h-24 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">Sem imagem</div>
        <img v-if="par.entrada.imagem_placa && !imagemIndisponivel.placaEntrada" class="mt-2 h-20 rounded-lg" :src="`/images${par.entrada.imagem_placa}`" alt="Placa lida na entrada"
            @error="imagemIndisponivel.placaEntrada = true" />
        <p class="mt-1 text-lg font-bold text-gray-900">{{ par.entrada.placa }}</p>
        <p class="text-sm text-gray-600">{{ formatarData(par.entrada.dataEntrada) }}</p>
      </div>
      <div>
        <p class="text-xs font-bold uppercase text-red-700">Saída</p>
        <img v-if="par.saida.imagem_carro && !imagemIndisponivel.saida" class="mt-1 rounded-lg" :src="`/images${par.saida.imagem_carro}`" alt=""
            @error="imagemIndisponivel.saida = true" />
        <div v-else class="mt-1 h-24 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">Sem imagem</div>
        <img v-if="par.saida.imagem_placa && !imagemIndisponivel.placaSaida" class="mt-2 h-20 rounded-lg" :src="`/images${par.saida.imagem_placa}`" alt="Placa lida na saída"
            @error="imagemIndisponivel.placaSaida = true" />
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

  <!-- Fotos da saída e, quando houver, da entrada correspondente -->
  <ModalDialog :show="showModalFoto" :larga="!!saidaFoto.entrada">
    <div :class="saidaFoto.entrada ? 'grid grid-cols-2 gap-4' : ''">
      <div v-if="saidaFoto.entrada">
        <p class="text-xs font-bold uppercase text-green-700">Entrada</p>
        <p class="text-lg font-bold text-gray-900">{{ saidaFoto.entrada.placa }}</p>
        <p class="text-sm text-gray-600">{{ formatarData(saidaFoto.entrada.dataEntrada) }}</p>
        <img v-if="saidaFoto.entrada.imagem" class="mt-3 rounded-lg" :src="`/images${saidaFoto.entrada.imagem}`" alt="" />
        <img v-if="saidaFoto.entrada.imagem_placa" class="mt-3 rounded-lg" :src="`/images${saidaFoto.entrada.imagem_placa}`" alt="" />
      </div>
      <div>
        <p class="text-xs font-bold uppercase text-red-700">Saída</p>
        <p class="text-lg font-bold text-gray-900">{{ saidaFoto.placa }}</p>
        <p class="text-sm text-gray-600">{{ formatarData(saidaFoto.data) }}</p>
        <img v-if="saidaFoto.imagem_carro" class="mt-3 rounded-lg" :src="`/images${saidaFoto.imagem_carro}`" alt="" />
        <img v-if="saidaFoto.imagem_placa" class="mt-3 rounded-lg" :src="`/images${saidaFoto.imagem_placa}`" alt="" />
      </div>
    </div>
    <div v-if="saidaFoto.associacao_automatica" class="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
      Associação feita automaticamente: a placa lida na saída (<b>{{ saidaFoto.placa }}</b>) é próxima da placa da entrada
      (<b>{{ saidaFoto.entrada.placa }}</b>). Se não for o mesmo veículo, desfaça a associação.
    </div>
    <div v-if="saidaFoto.associacao_automatica" class="mt-4 flex justify-end gap-2">
      <button type="button" @click="showModalFoto = false" class="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50">
        Fechar
      </button>
      <button type="button" :disabled="processando" @click="desassociar" class="px-3 py-2 rounded-md bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
        Desassociar
      </button>
    </div>
  </ModalDialog>

  <section aria-labelledby="titulo-saidas" class="lg:sticky lg:top-4">
    <h3 id="titulo-saidas" class="text-sm font-medium text-gray-900">
      Saídas
      <span class="ml-1 py-0.5 px-2 rounded-full text-xs font-medium bg-gray-100 text-gray-900">{{ total }}</span>
      <span class="ml-1 text-xs font-normal text-gray-500">na última hora</span>
    </h3>
    <p class="mt-1 text-xs font-medium" :class="pendentes > 0 ? 'text-amber-800' : 'text-gray-500'">
      <span class="inline-block h-2 w-2 rounded-full bg-amber-400 mr-1" aria-hidden="true"></span>
      {{ pendentes }} sem entrada identificada
    </p>
    <p class="mt-1 text-xs font-medium" :class="totalAutomaticas + totalPlacasProximas > 0 ? 'text-blue-800' : 'text-gray-500'">
      <span class="inline-block h-2 w-2 rounded-full bg-blue-300 mr-1" aria-hidden="true"></span>
      {{ totalAutomaticas }} associadas automaticamente por placa próxima<template v-if="totalPlacasProximas > 0">;
      {{ totalPlacasProximas }} com placa próxima aguardando associação</template>
    </p>
    <p class="mt-1 text-xs text-gray-500">
      Para uma saída sem entrada: arraste-a até a entrada correspondente (ou a entrada até ela), ou selecione-a e clique em <b>Associar saída</b> no card da entrada.
    </p>
    <p v-if="saidaSelecionada" class="mt-2 text-xs text-indigo-700">
      Saída <b>{{ saidaSelecionada.placa }}</b> selecionada.
      <a href="#" class="text-gray-500 underline" @click.prevent="limparSelecao">Limpar seleção</a>
    </p>

    <div v-if="saidas.length===0" class="mt-2 text-sky-500">Nenhuma saída na última hora</div>
    <div v-else class="mt-3 grid grid-cols-1 gap-3 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:p-1">
      <template v-for="saida in saidas" :key="saida.chave">
        <!-- saída já associada a uma entrada: só consulta -->
        <div v-if="saida.entrada" @click="abrirFoto(saida)"
            class="cursor-pointer relative rounded-lg border px-2 py-2 shadow-sm flex items-center space-x-3 hover:border-gray-400"
            :class="saida.associacao_automatica ? 'bg-blue-100 border-blue-300'
                      : saida.in_whitelist ? 'white-list border-green-300' : 'bg-white border-gray-300'">
          <div class="flex-shrink-0">
            <img v-if="saida.imagem_carro_thumb" class="h-14 w-14 rounded-lg" :src="`/images${saida.imagem_carro_thumb}`" alt="Ver fotos da entrada e da saída" />
            <div v-else class="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">sem foto</div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-lg font-bold text-gray-900">
              {{ saida.placa }}
              <SinaisVeiculo :placa="saida.entrada.placa" :quando="saida.entrada.dataEntrada" class="ml-1" />
            </p>
            <p v-if="saida.entrada.placa !== saida.placa" class="text-xs text-gray-500 truncate">lida na entrada: {{ saida.entrada.placa }}</p>
            <p class="text-xs text-red-700 font-bold truncate">Saída: {{ formatarHora(saida.data) }} {{ nomePortaria(saida.portaria_id) }}</p>
            <p class="text-xs text-green-700 font-bold truncate">Entrada: {{ formatarHora(saida.entrada.dataEntrada) }} {{ nomePortaria(saida.entrada.portaria_id) }}</p>
            <p class="text-xs text-gray-600 truncate">Permanência: {{ calcularPermanencia(saida.entrada.dataEntrada, saida.data) }}</p>
            <p v-if="saida.associacao_automatica" class="text-xs font-medium text-blue-800">Associada automaticamente (placa próxima)</p>
            <button v-if="saida.associacao_automatica" type="button" @click.stop="abrirFoto(saida)"
                title="Conferir as fotos e desfazer a associação"
                class="mt-1 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-gray-500 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
              Conferir / Desassociar
            </button>
            <p v-if="saida.in_whitelist" class="text-xs font-medium text-green-800 truncate">
              Green list{{ saida.whitelist_nome ? `: ${saida.whitelist_nome}` : '' }}
            </p>
          </div>
        </div>

        <!-- saída sem entrada identificada: pode ser associada a uma entrada -->
        <div v-else
            draggable="true"
            @dragstart="iniciarArraste($event, saida)"
            @dragend="finalizarArraste"
            @dragover="permitirSoltarEntrada($event, saida)"
            @dragleave="sairDoAlvo(saida)"
            @drop.prevent="soltarEntrada(saida)"
            :title="saidaAnteriorAEntrada(saida) ? 'Saída anterior à entrada: não pode ser associada' : null"
            @click="selecionar(saida)"
            class="cursor-grab relative rounded-lg border px-2 py-2 shadow-sm flex items-center space-x-3 hover:border-gray-400"
            :class="[saida.in_whitelist ? 'white-list border-green-300'
                       : entradasParecidas[saida.chave] ? 'bg-blue-100 border-blue-300' : 'bg-amber-50 border-amber-300',
                     (saidaSelecionada && saidaSelecionada.chave === saida.chave) || alvoChave === saida.chave ? 'ring-4 ring-indigo-500 border-indigo-500'
                       : placaParecida(saida) ? 'ring-2 ring-amber-400 border-amber-400' : '',
                     arrastando && arrastando.chave === saida.chave ? 'opacity-50' : '',
                     saidaAnteriorAEntrada(saida) ? 'opacity-40' : '']">
          <div class="flex-shrink-0">
            <img v-if="saida.imagem_carro_thumb" class="h-14 w-14 rounded-lg cursor-zoom-in" :src="`/images${saida.imagem_carro_thumb}`"
                alt="Ver foto da saída" title="Ver foto" draggable="false" @click.stop="abrirFoto(saida)" />
            <div v-else class="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">sem foto</div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-lg font-bold text-gray-900">
              {{ saida.placa }}
              <SinaisVeiculo :placa="saida.placa" :quando="saida.data" class="ml-1" />
            </p>
            <p class="text-xs text-red-700 font-bold truncate">Saída: {{ formatarHora(saida.data) }} {{ nomePortaria(saida.portaria_id) }}</p>
            <p class="text-xs font-medium text-amber-800 truncate">Sem entrada identificada</p>
            <p v-if="saida.in_whitelist" class="text-xs font-medium text-green-800 truncate">
              Green list{{ saida.whitelist_nome ? `: ${saida.whitelist_nome}` : '' }}
            </p>
            <p v-if="entradasParecidas[saida.chave]" class="text-xs font-medium text-blue-800 truncate">
              Parecida com: {{ entradasParecidas[saida.chave].map((entrada) => entrada.placa).join(', ') }}
            </p>
            <button v-if="entradasParecidas[saida.chave]" type="button" @click.stop="associarComParecida(saida)"
                :title="`Associar com a entrada ${entradasParecidas[saida.chave][0].placa}`"
                class="mt-1 mr-1 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Associar
            </button>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { notify } from 'notiwind';

import usePortarias from '../composables/usePortarias';
import useTrafegos from '../composables/useTrafegos';
import useSaidasNaoIdentificadas, { podeAssociar } from '../composables/useSaidasNaoIdentificadas';

import { formatarData, formatarHora, calcularPermanencia } from '../utils/dateUtil';
import { diferencasPlacas as diferencas, placaSugerida } from '../utils/placaUtil';

import ModalDialog from './ModalDialog.vue';
import SinaisVeiculo from './SinaisVeiculo.vue';

export default {
  components: { ModalDialog, SinaisVeiculo },
  setup() {
    const mapPortaria = computed(() => usePortarias.state.portarias.map);
    const nomePortaria = (id) => (mapPortaria.value[id] ? mapPortaria.value[id].nome : '');

    // saídas da última hora: as que têm "entrada" já estão associadas; as demais aguardam associação
    const saidas = computed(() => useSaidasNaoIdentificadas.state.saidas.lista);
    const total = computed(() => useSaidasNaoIdentificadas.state.saidas.total);
    const pendentes = computed(() => useSaidasNaoIdentificadas.state.saidas.pendentes);
    const saidaSelecionada = computed(() => useSaidasNaoIdentificadas.state.interacao.selecionada);
    const arrastando = computed(() => useSaidasNaoIdentificadas.state.interacao.arrastando);

    // saídas com placa próxima da de algum veículo em travessia (que entrou antes dela): o card fica azul
    // e lista as placas parecidas, para ajudar o operador na associação
    const entradasParecidas = computed(() => {
      const mapa = {};
      for (const saida of saidas.value) {
        const entradas = useTrafegos.state.trafegos.lista
          .filter((entrada) => podeAssociar(entrada, saida) && placaSugerida(entrada, saida))
          // a mais parecida primeiro; no empate, a entrada mais recente
          .sort(
            (a, b) =>
              diferencas(a.placa, saida.placa) - diferencas(b.placa, saida.placa) ||
              new Date(b.dataEntrada) - new Date(a.dataEntrada)
          );
        if (entradas.length > 0) {
          mapa[saida.chave] = entradas;
        }
      }
      return mapa;
    });

    // total de saídas com entrada parecida em travessia (os cards azuis)
    const totalPlacasProximas = computed(
      () => saidas.value.filter((saida) => entradasParecidas.value[saida.chave] && !saida.in_whitelist).length
    );

    // saídas que o sistema associou sozinho a uma entrada de placa próxima (cards azuis com entrada)
    const totalAutomaticas = computed(() => saidas.value.filter((saida) => saida.associacao_automatica).length);

    // botão "Associar" do card: mesmo efeito de arrastar a saída até a entrada correspondente (a mais parecida)
    const associarComParecida = (saida) => {
      const entradas = entradasParecidas.value[saida.chave];
      if (entradas) {
        useSaidasNaoIdentificadas.actions.pedirAssociacao(entradas[0], saida);
      }
    };

    onMounted(() => {
      useSaidasNaoIdentificadas.actions.ativar().catch((error) => console.log('Erro carregando as saídas', error));
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
      event.dataTransfer.setData('text/plain', `saida:${saida.chave}`);
      // o estado muda depois do dragstart: alterar a tela durante o evento faz o Chrome cancelar o arraste
      setTimeout(() => useSaidasNaoIdentificadas.actions.iniciarArraste(saida), 0);
    };

    const finalizarArraste = () => {
      useSaidasNaoIdentificadas.actions.finalizarArraste();
    };

    // ---------- sentido inverso: uma entrada arrastada das listas é solta sobre o card da saída
    const entradaArrastada = computed(() => useSaidasNaoIdentificadas.state.interacao.entradaArrastada);
    const alvoChave = ref(null);

    const saidaAnteriorAEntrada = (saida) => !!entradaArrastada.value && !podeAssociar(entradaArrastada.value, saida);

    // destaca as saídas com placa parecida com a da entrada arrastada
    const placaParecida = (saida) =>
      podeAssociar(entradaArrastada.value, saida) && placaSugerida(entradaArrastada.value, saida);

    const permitirSoltarEntrada = (event, saida) => {
      if (podeAssociar(entradaArrastada.value, saida)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        alvoChave.value = saida.chave;
      }
    };

    const sairDoAlvo = (saida) => {
      if (alvoChave.value === saida.chave) {
        alvoChave.value = null;
      }
    };

    const soltarEntrada = (saida) => {
      const entrada = entradaArrastada.value;
      alvoChave.value = null;
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
    const imagemIndisponivel = ref({ entrada: false, saida: false, placaEntrada: false, placaSaida: false });
    const showModalAssociar = ref(false);

    // pedido vindo de um card de entrada (saída solta sobre ele ou botão "Associar saída")
    watch(
      () => useSaidasNaoIdentificadas.state.interacao.pedido,
      (pedido) => {
        if (pedido) {
          par.value = { entrada: pedido.entrada, saida: pedido.saida };
          imagemIndisponivel.value = { entrada: false, saida: false, placaEntrada: false, placaSaida: false };
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

    // desfaz a associação automática da saída aberta na janela de fotos
    const desassociar = async () => {
      if (processando.value) return;
      processando.value = true;
      try {
        await useSaidasNaoIdentificadas.actions.desassociar(saidaFoto.value.saida_id);
        notify({ group: 'success', title: 'Sucesso', text: `Associação da saída ${saidaFoto.value.placa} desfeita` }, 4000);
      } catch (error) {
        notify({ group: 'error', title: 'Erro', text: error.message || 'Erro desfazendo a associação' }, 4000);
      } finally {
        processando.value = false;
        showModalFoto.value = false;
      }
    };

    return {
      nomePortaria,
      saidas,
      total,
      pendentes,
      entradasParecidas,
      totalPlacasProximas,
      totalAutomaticas,
      desassociar,
      associarComParecida,
      saidaSelecionada,
      arrastando,
      selecionar,
      limparSelecao,
      iniciarArraste,
      finalizarArraste,
      alvoChave,
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
      diferencas,
      formatarData,
      formatarHora,
      calcularPermanencia,
    };
  },
};
</script>
