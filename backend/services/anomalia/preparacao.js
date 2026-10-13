'use strict';

// Preparação dos dados do detector de anomalias: transforma as linhas de Trafegos e Saidas_nao_identificadas
// em passagens (leituras de placa numa portaria) e classifica as viagens. Funções puras.

const DIA_MS = 24 * 3600 * 1000;

const normalizarPlaca = (placa) => (placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// placa brasileira, padrão antigo (ABC1234) ou Mercosul (ABC1D23); o resto é leitura inválida da câmera
const placaValida = (placa) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa);

/** Dia (inteiro crescente), hora e tipo de dia no fuso do processo (TZ do container = fuso do condomínio). */
const tempoLocal = (ms) => {
  const data = new Date(ms);
  const diaSemana = data.getDay();
  return {
    dia: Math.floor((ms - data.getTimezoneOffset() * 60000) / DIA_MS),
    hora: data.getHours(),
    fds: diaSemana === 0 || diaSemana === 6,
  };
};

const inicioDoDiaLocal = (ms) => {
  const data = new Date(ms);
  data.setHours(0, 0, 0, 0);
  return data.getTime();
};

const dataLocalIso = (ms) => {
  const data = new Date(ms);
  const doisDigitos = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
};

/** Primeiro índice de "lista" (ordenada por "campo") cujo valor é >= limite. */
const primeiroIndice = (lista, limite, campo = 't') => {
  let inicio = 0;
  let fim = lista.length;
  while (inicio < fim) {
    const meio = (inicio + fim) >> 1;
    if (lista[meio][campo] < limite) inicio = meio + 1;
    else fim = meio;
  }
  return inicio;
};

const SITUACOES = ['valida', 'sem_saida', 'saida_antes_da_entrada', 'passagem_intermediaria', 'acima_do_teto'];

/**
 * Monta o índice de passagens e viagens por placa.
 *  - trafegos: linhas de Trafegos (id, placa, placa_saida, dataEntrada, dataSaida, identificador_placa_saida,
 *    portaria_entrada_id, portaria_saida_id, in_whitelist, in_blacklist)
 *  - saidas: linhas de Saidas_nao_identificadas (id, placa, data, camera_id, status); as "associada" já estão
 *    no tráfego correspondente e ficam fora
 *  - portariaDaCamera: Map camera_id -> portaria_id
 *  - greenList: placas da green list atual do cliente (o detector não avalia essas placas)
 * A saída de um tráfego conta para a placa da entrada, mesmo quando a placa lida na saída é diferente: a
 * associação (do sistema ou do operador) diz que é o mesmo veículo.
 */
const montarIndice = ({ trafegos, saidas, portariaDaCamera = new Map(), greenList = [] }, { tetoDuracaoS, toleranciaSaidaDuplaS = 600 }) => {
  const porPlaca = new Map();
  const dados = (chave) => {
    let registro = porPlaca.get(chave);
    if (!registro) {
      registro = { chave, passagens: [], viagens: [], greenList: false, redList: false };
      porPlaca.set(chave, registro);
    }
    return registro;
  };
  const novaPassagem = (chave, ms, extras) => {
    const passagem = { chave, t: ms, ...tempoLocal(ms), ...extras };
    dados(chave).passagens.push(passagem);
    return passagem;
  };

  const resumo = { trafegos: 0, passagens: 0, saidas_sem_entrada: 0, placas_invalidas: 0, viagens: {} };
  SITUACOES.forEach((situacao) => (resumo.viagens[situacao] = 0));

  const candidatas = [];
  for (const trafego of trafegos) {
    const chave = normalizarPlaca(trafego.placa);
    if (!placaValida(chave) || !trafego.dataEntrada) {
      resumo.placas_invalidas++;
      continue;
    }
    resumo.trafegos++;
    const registro = dados(chave);
    if (trafego.in_blacklist) registro.redList = true;
    const tEntrada = new Date(trafego.dataEntrada).getTime();
    novaPassagem(chave, tEntrada, { sentido: 'E', portaria: trafego.portaria_entrada_id, trafegoId: trafego.id });

    // entrada sem saída: viagem aberta ou baixa manual (nenhuma câmera leu o veículo saindo, então a data da
    // baixa não é uma saída observada)
    if (!trafego.dataSaida || !trafego.identificador_placa_saida) {
      resumo.viagens.sem_saida++;
      continue;
    }
    const tSaida = new Date(trafego.dataSaida).getTime();
    const placaLida = normalizarPlaca(trafego.placa_saida) || chave;
    const saida = novaPassagem(chave, tSaida, {
      sentido: 'S',
      portaria: trafego.portaria_saida_id,
      trafegoId: trafego.id,
      placaLida,
    });
    candidatas.push({ chave, trafegoId: trafego.id, tEntrada, tSaida, saida, placasDiferentes: placaLida !== chave,
      portariaEntrada: trafego.portaria_entrada_id, portariaSaida: trafego.portaria_saida_id });
  }

  for (const saida of saidas) {
    if (saida.status === 'associada') continue;
    const chave = normalizarPlaca(saida.placa);
    if (!placaValida(chave) || !saida.data) {
      resumo.placas_invalidas++;
      continue;
    }
    resumo.saidas_sem_entrada++;
    novaPassagem(chave, new Date(saida.data).getTime(), {
      sentido: 'S',
      portaria: portariaDaCamera.get(saida.camera_id) || null,
      saidaId: saida.id,
    });
  }

  // vale a green list de agora, não a marcação gravada em cada tráfego: quem saiu da lista volta a ser avaliado
  for (const placa of greenList) {
    const registro = porPlaca.get(normalizarPlaca(placa));
    if (registro) registro.greenList = true;
  }

  const eventos = [];
  for (const registro of porPlaca.values()) {
    registro.passagens.sort((a, b) => a.t - b.t);
    registro.passagens.forEach((passagem, indice) => {
      passagem.idx = indice;
      eventos.push(passagem);
    });
    resumo.passagens += registro.passagens.length;
  }
  eventos.sort((a, b) => a.t - b.t || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : a.idx - b.idx));

  // classificação das viagens com saída lida por câmera
  for (const viagem of candidatas) {
    let situacao = 'valida';
    if (viagem.tSaida <= viagem.tEntrada) {
      situacao = 'saida_antes_da_entrada';
    } else {
      // outra leitura da mesma placa entre a entrada e a saída: a saída foi casada com uma entrada antiga.
      // Uma leitura de saída pouco antes da saída do tráfego é o mesmo veículo lido por duas câmeras de saída.
      const passagens = porPlaca.get(viagem.chave).passagens;
      for (let i = primeiroIndice(passagens, viagem.tEntrada); i < passagens.length && passagens[i].t < viagem.tSaida; i++) {
        const outra = passagens[i];
        if (outra.t <= viagem.tEntrada || outra.trafegoId === viagem.trafegoId) continue;
        if (outra.sentido === 'E' || viagem.tSaida - outra.t > toleranciaSaidaDuplaS * 1000) {
          situacao = 'passagem_intermediaria';
          break;
        }
      }
      if (situacao === 'valida' && (viagem.tSaida - viagem.tEntrada) / 1000 > tetoDuracaoS) {
        situacao = 'acima_do_teto';
      }
    }
    resumo.viagens[situacao]++;
    viagem.saida.situacaoViagem = situacao;
    if (situacao === 'valida') {
      const valida = {
        trafegoId: viagem.trafegoId,
        tEntrada: viagem.tEntrada,
        tSaida: viagem.tSaida,
        duracao: (viagem.tSaida - viagem.tEntrada) / 1000,
        placasDiferentes: viagem.placasDiferentes,
        portariaEntrada: viagem.portariaEntrada,
        portariaSaida: viagem.portariaSaida,
      };
      viagem.saida.viagem = valida;
      porPlaca.get(viagem.chave).viagens.push(valida);
    }
  }
  for (const registro of porPlaca.values()) {
    registro.viagens.sort((a, b) => a.tSaida - b.tSaida);
  }

  return { porPlaca, eventos, resumo };
};

/**
 * Índice para achar placas a 1 caractere de distância (troca, sobra ou falta) de alguma placa frequente,
 * sem comparar par a par.
 */
const criarIndiceVizinhas = (placasFrequentes) => {
  const exatas = new Set(placasFrequentes);
  const trocas = new Set();
  const faltas = new Set();
  for (const placa of placasFrequentes) {
    for (let i = 0; i < placa.length; i++) {
      trocas.add(`${placa.slice(0, i)}*${placa.slice(i + 1)}`);
      faltas.add(placa.slice(0, i) + placa.slice(i + 1));
    }
  }
  return { exatas, trocas, faltas };
};

/** Indica se "placa" (que não é frequente) está a 1 caractere de alguma placa frequente do índice. */
const ehVizinhaDeFrequente = (placa, indice) => {
  if (indice.exatas.has(placa)) return false;
  if (indice.faltas.has(placa)) return true;
  for (let i = 0; i < placa.length; i++) {
    if (indice.trocas.has(`${placa.slice(0, i)}*${placa.slice(i + 1)}`)) return true;
    if (indice.exatas.has(placa.slice(0, i) + placa.slice(i + 1))) return true;
  }
  return false;
};

module.exports = {
  DIA_MS,
  SITUACOES,
  normalizarPlaca,
  placaValida,
  tempoLocal,
  inicioDoDiaLocal,
  dataLocalIso,
  primeiroIndice,
  montarIndice,
  criarIndiceVizinhas,
  ehVizinhaDeFrequente,
};
