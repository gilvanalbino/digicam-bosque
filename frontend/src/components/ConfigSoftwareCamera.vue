<template>
  <!-- identificação por software da câmera (docs/plano_identificacao_placas_software.md, seção 4) -->
  <div class="shadow sm:rounded-md bg-white px-4 py-5 sm:p-6 mt-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-gray-900">Identificação por software</h3>
        <p class="text-sm text-gray-500">
          Lê as placas pelo vídeo, junto com a câmera. Ligada, vale a placa do software quando as duas divergem e ele
          registra as passagens que a câmera não leu.
        </p>
      </div>
      <button type="button" role="switch" :aria-checked="ligada" @click="ligada = !ligada"
              :class="ligada ? 'bg-indigo-600' : 'bg-gray-300'"
              class="relative inline-flex h-7 w-14 flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <span :class="ligada ? 'translate-x-7' : 'translate-x-0'"
              class="inline-block h-7 w-7 transform rounded-full bg-white shadow ring-1 ring-gray-300 transition"></span>
        <span class="sr-only">Ligar identificação por software</span>
      </button>
    </div>
    <p class="mt-1 text-sm font-medium" :class="ligada ? 'text-indigo-700' : 'text-gray-500'">{{ ligada ? 'Ligada' : 'Desligada' }}</p>

    <div class="mt-5">
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" @click="carregarFoto" :disabled="carregando" class="botao">
          {{ carregando ? 'Buscando foto…' : foto ? 'Atualizar foto' : 'Mostrar foto da câmera' }}
        </button>
        <template v-if="foto">
          <span class="text-sm text-gray-500 ml-2">Desenhar:</span>
          <button type="button" @click="iniciar('linha')" :class="{ ativo: modo === 'linha' }" class="botao">1. Linha (2 cliques)</button>
          <button type="button" @click="iniciar('dentro')" :class="{ ativo: modo === 'dentro' }" class="botao">2. Lado de dentro (1 clique)</button>
          <button type="button" @click="iniciar('area')" :class="{ ativo: modo === 'area' }" class="botao">3. Área de interesse (opcional)</button>
          <button v-if="config.area.length" type="button" @click="limparArea" class="botao">Limpar área</button>
        </template>
      </div>
      <p class="mt-2 text-sm text-gray-600">{{ instrucao }}</p>

      <div v-if="foto" class="mt-3 relative select-none" ref="caixa">
        <img :src="foto" @load="aoCarregarImagem" ref="imagem" class="w-full rounded-md block" alt="Foto atual da câmera" />
        <canvas ref="tela" class="absolute inset-0 w-full h-full cursor-crosshair" @click="clique" @dblclick.prevent="fecharArea"></canvas>
      </div>

      <details class="mt-4">
        <summary class="text-sm text-gray-600 cursor-pointer">Avançado</summary>
        <div class="mt-3 grid grid-cols-6 gap-4">
          <label class="col-span-6 sm:col-span-2 text-sm text-gray-700">Quadros por segundo
            <input type="number" min="1" max="15" v-model.number="config.qps" class="campo" /></label>
          <label class="col-span-6 sm:col-span-2 text-sm text-gray-700">Confiança do detector
            <input type="number" min="0.1" max="0.9" step="0.05" v-model.number="config.detector.confianca" class="campo" /></label>
          <label class="col-span-6 sm:col-span-2 text-sm text-gray-700">Ponto do veículo
            <select v-model="config.linha.ancora" class="campo">
              <option value="centro">Centro da caixa</option>
              <option value="base">Base da caixa</option>
            </select></label>
        </div>
      </details>
    </div>

    <p v-if="erro" class="mt-3 text-sm text-red-600">{{ erro }}</p>
    <div class="mt-4 text-right">
      <button type="button" @click="salvar" :disabled="salvando"
              class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
        {{ salvando ? 'Salvando…' : 'Salvar identificação por software' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { notify } from 'notiwind';
import useLogin from '../composables/useLogin';
import { obterFotoCamera, salvarSoftwareCamera } from '../database/dbCameras';

const props = defineProps({ camera: { type: Object, required: true } });
const emit = defineEmits(['salvo']);

const copiar = (v) => JSON.parse(JSON.stringify(v));
const inicial = props.camera.config_software || {};
const ligada = ref(!!props.camera.identificacao_software);
const config = reactive({
  canal: inicial.canal || 101,
  largura: inicial.largura || 1920,
  altura: inicial.altura || 1080,
  qps: inicial.qps || 5,
  linha: { p1: null, p2: null, ponto_dentro: null, ancora: 'centro', margem: 15, ...copiar(inicial.linha || {}) },
  area: copiar(inicial.area || []),
  detector: { confianca: 0.25, ...copiar(inicial.detector || {}) },
});

const foto = ref(null);
const carregando = ref(false);
const salvando = ref(false);
const erro = ref('');
const modo = ref(null);
const pontosLinha = ref([]);
const areaEmDesenho = ref([]);
const imagem = ref(null);
const tela = ref(null);

const instrucao = computed(() => {
  if (!foto.value) return 'Mostre a foto da câmera para desenhar a linha virtual. Quem cruza a linha para o lado de dentro entrou.';
  if (modo.value === 'linha') return `Clique nos dois pontos da linha (${pontosLinha.value.length} de 2).`;
  if (modo.value === 'dentro') return 'Clique num ponto do lado de dentro do condomínio.';
  if (modo.value === 'area') return 'Clique nos cantos da área onde os veículos passam; duplo clique fecha a área.';
  return 'Verde: lado de dentro. A seta mostra o sentido de entrada. Azul: área de interesse.';
});

// ---------- coordenadas: a configuração fica em pixels da imagem original, não da tela
const escala = () => (imagem.value ? imagem.value.clientWidth / config.largura : 1);
const paraImagem = (ev) => {
  const r = tela.value.getBoundingClientRect();
  const e = escala();
  return [Math.round((ev.clientX - r.left) / e), Math.round((ev.clientY - r.top) / e)];
};

const carregarFoto = async () => {
  carregando.value = true;
  erro.value = '';
  try {
    foto.value = await obterFotoCamera(useLogin.state.auth.token, props.camera.id);
  } catch (e) {
    erro.value = 'A câmera não respondeu. Tente de novo.';
  } finally {
    carregando.value = false;
  }
};

const aoCarregarImagem = () => {
  config.largura = imagem.value.naturalWidth || config.largura;
  config.altura = imagem.value.naturalHeight || config.altura;
  nextTick(desenhar);
};

const iniciar = (m) => {
  modo.value = m;
  if (m === 'linha') pontosLinha.value = [];
  if (m === 'area') areaEmDesenho.value = [];
};

const clique = (ev) => {
  const p = paraImagem(ev);
  if (modo.value === 'linha') {
    pontosLinha.value.push(p);
    if (pontosLinha.value.length === 2) {
      [config.linha.p1, config.linha.p2] = pontosLinha.value;
      modo.value = config.linha.ponto_dentro ? null : 'dentro';
    }
  } else if (modo.value === 'dentro') {
    config.linha.ponto_dentro = p;
    modo.value = null;
  } else if (modo.value === 'area') {
    areaEmDesenho.value.push(p);
  }
  desenhar();
};

const fecharArea = () => {
  if (modo.value !== 'area') return;
  // o duplo clique também gerou dois cliques simples: o último ponto repetido sai
  const pts = areaEmDesenho.value.slice(0, -1);
  if (pts.length >= 3) config.area = pts;
  areaEmDesenho.value = [];
  modo.value = null;
  desenhar();
};

const limparArea = () => {
  config.area = [];
  desenhar();
};

// ---------- desenho
const lado = (p1, p2, p) => (p2[0] - p1[0]) * (p[1] - p1[1]) - (p2[1] - p1[1]) * (p[0] - p1[0]);

/** Polígono do semiplano do lado de dentro, recortado no retângulo da imagem (Sutherland-Hodgman). */
const semiplanoDentro = () => {
  const { p1, p2, ponto_dentro: d } = config.linha;
  if (!p1 || !p2 || !d) return [];
  const s = Math.sign(lado(p1, p2, d));
  const ret = [[0, 0], [config.largura, 0], [config.largura, config.altura], [0, config.altura]];
  const saida = [];
  for (let i = 0; i < ret.length; i++) {
    const a = ret[i];
    const b = ret[(i + 1) % ret.length];
    const la = Math.sign(lado(p1, p2, a)) === s;
    const lb = Math.sign(lado(p1, p2, b)) === s;
    if (la) saida.push(a);
    if (la !== lb) {
      const va = lado(p1, p2, a);
      const vb = lado(p1, p2, b);
      const t = va / (va - vb);
      saida.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return saida;
};

const desenhar = () => {
  const c = tela.value;
  if (!c || !imagem.value) return;
  c.width = imagem.value.clientWidth;
  c.height = imagem.value.clientHeight;
  const ctx = c.getContext('2d');
  const e = escala();
  const P = (p) => [p[0] * e, p[1] * e];
  ctx.clearRect(0, 0, c.width, c.height);

  const poligono = (pts, preenchimento, borda) => {
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.map(P).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    if (preenchimento) { ctx.fillStyle = preenchimento; ctx.fill(); }
    if (borda) { ctx.strokeStyle = borda; ctx.lineWidth = 2; ctx.stroke(); }
  };

  poligono(semiplanoDentro(), 'rgba(22, 163, 74, 0.18)');
  if (config.area.length >= 3) poligono(config.area, 'rgba(37, 99, 235, 0.10)', 'rgba(37, 99, 235, 0.9)');
  if (areaEmDesenho.value.length) {
    ctx.beginPath();
    areaEmDesenho.value.map(P).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.9)';
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const { p1, p2, ponto_dentro: d } = config.linha;
  const linhaPts = p1 && p2 ? [p1, p2] : pontosLinha.value;
  if (linhaPts.length === 2) {
    const [a, b] = linhaPts.map(P);
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 5;
    ctx.stroke();
    if (d) {
      // seta "entrada": do lado de fora para o de dentro, perpendicular à linha, no meio dela
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let n = [-(b[1] - a[1]), b[0] - a[0]];
      const len = Math.hypot(...n) || 1;
      n = [n[0] / len, n[1] / len];
      if (Math.sign(lado(a, b, [m[0] + n[0], m[1] + n[1]])) !== Math.sign(lado(a, b, P(d)))) n = [-n[0], -n[1]];
      const ini = [m[0] - n[0] * 50, m[1] - n[1] * 50];
      const fim = [m[0] + n[0] * 50, m[1] + n[1] * 50];
      ctx.beginPath();
      ctx.moveTo(...ini);
      ctx.lineTo(...fim);
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 4;
      ctx.stroke();
      const ang = Math.atan2(fim[1] - ini[1], fim[0] - ini[0]);
      ctx.beginPath();
      ctx.moveTo(...fim);
      ctx.lineTo(fim[0] - 14 * Math.cos(ang - 0.5), fim[1] - 14 * Math.sin(ang - 0.5));
      ctx.lineTo(fim[0] - 14 * Math.cos(ang + 0.5), fim[1] - 14 * Math.sin(ang + 0.5));
      ctx.closePath();
      ctx.fillStyle = '#16a34a';
      ctx.fill();
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('entrada', fim[0] + 8, fim[1]);
    }
  }
  for (const p of linhaPts.length === 1 ? linhaPts : []) {
    const [x, y] = P(p);
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#facc15';
    ctx.fill();
  }
  if (d) {
    const [x, y] = P(d);
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#16a34a';
    ctx.fill();
  }
};

watch(() => [config.area, config.linha], () => nextTick(desenhar), { deep: true });
const aoRedimensionar = () => desenhar();
window.addEventListener('resize', aoRedimensionar);
onBeforeUnmount(() => window.removeEventListener('resize', aoRedimensionar));

const configuracaoCompleta = () => config.linha.p1 && config.linha.p2 && config.linha.ponto_dentro;

const salvar = async () => {
  erro.value = '';
  if (ligada.value && !configuracaoCompleta()) {
    erro.value = 'Desenhe a linha e o lado de dentro antes de ligar.';
    return;
  }
  salvando.value = true;
  try {
    const r = await salvarSoftwareCamera(
      useLogin.state.auth.token,
      props.camera.id,
      ligada.value,
      configuracaoCompleta() ? copiar(config) : null
    );
    if (r.status !== 'OK') {
      erro.value = r.message || 'Não foi possível salvar.';
      return;
    }
    notify({ group: 'success', title: 'Sucesso', text: 'Identificação por software salva. Vale em até 1 minuto.' }, 4000);
    emit('salvo', r);
  } catch (e) {
    erro.value = 'Erro ao salvar a identificação por software.';
  } finally {
    salvando.value = false;
  }
};
</script>

<style scoped>
.botao {
  @apply bg-white py-1.5 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50;
}
.botao.ativo {
  @apply border-indigo-500 ring-2 ring-indigo-500 text-indigo-700;
}
.campo {
  @apply mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500;
}
</style>
