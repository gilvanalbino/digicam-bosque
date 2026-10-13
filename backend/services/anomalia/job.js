'use strict';

// Modos de execução do detector de anomalias (docs/plano_anomalia.md, item 8). Só leem as tabelas
// operacionais; todas as gravações são nas tabelas Anomalia_*.
const p = require('./parametros');
const dados = require('./dados');
const motor = require('./motor');
const { DIA_MS, montarIndice, inicioDoDiaLocal } = require('./preparacao');

const MARGEM_CARGA_DIAS = 2;

// Map que anota as placas cujo estado mudou, para gravar só essas
class EstadosAlterados extends Map {
  constructor(entradas) {
    super(entradas);
    this.alterados = new Set();
  }
  set(chave, valor) {
    if (this.alterados) this.alterados.add(chave);
    return super.set(chave, valor);
  }
}

const carregarIndice = async (clientId, de, ate) => {
  const historico = await dados.carregarHistorico(clientId, new Date(de), new Date(ate));
  return montarIndice(historico, { tetoDuracaoS: p.TETO_DURACAO_S, toleranciaSaidaDuplaS: p.TOLERANCIA_SAIDA_DUPLA_S });
};

const comRegistro = async (clientId, modo, periodoInicio, periodoFim, tarefa) => {
  const execucao = await dados.iniciarExecucao(clientId, modo, new Date(periodoInicio), new Date(periodoFim));
  try {
    const resumo = await tarefa();
    await dados.concluirExecucao(execucao, resumo);
    return resumo;
  } catch (erro) {
    await dados.falharExecucao(execucao, erro);
    throw erro;
  }
};

/**
 * Analisa as passagens ainda não analisadas (do cursor até agora menos a margem de consolidação).
 * Na primeira execução, analisa os últimos dias, depois de um período de aquecimento do EWMA.
 */
const executarIncremental = async (clientId, agora = new Date()) => {
  const ate = agora.getTime() - p.MARGEM_CONSOLIDACAO_MIN * 60000;
  const cursor = await dados.obterCursor(clientId);
  const primeira = !cursor;
  const de = primeira ? inicioDoDiaLocal(ate - p.DIAS_PRIMEIRA_EXECUCAO * DIA_MS) : new Date(cursor).getTime();
  if (de >= ate) return null;

  return comRegistro(clientId, 'incremental', de, ate, async () => {
    const aquecimento = primeira ? p.DIAS_AQUECIMENTO : 0;
    const indice = await carregarIndice(clientId, de - (p.JANELA_REFERENCIA_DIAS + aquecimento + MARGEM_CARGA_DIAS) * DIA_MS, ate);
    const estados = new EstadosAlterados(primeira ? [] : await dados.carregarEstados(clientId));
    if (primeira) {
      motor.processarPeriodo(indice, de - aquecimento * DIA_MS, de, estados, p);
    }
    const recentes = await dados.carregarAlertasRecentes(clientId, new Date(de - (p.CARENCIA_REPETICAO_DIAS + 1) * DIA_MS));
    const resultado = motor.processarPeriodo(indice, de, ate, estados, p, { recentes });
    const gravacao = await dados.gravarAlertas(clientId, resultado.alertas);
    const repeticoes = await dados.aplicarRepeticoes(resultado.repeticoes);
    const estadosGravados = await dados.salvarEstados(clientId, estados, estados.alterados);

    // atraso entre a passagem e a geração do alerta (não se aplica à carga inicial)
    const novos = primeira ? [] : resultado.alertas;
    const atrasos = novos.map((alerta) => (Date.now() - alerta.ocorrido_em.getTime()) / 1000);
    return {
      primeira_execucao: primeira,
      avaliacao: resultado.resumo,
      alertas: { gerados: resultado.alertas.length, novos: gravacao.novos, atualizados: gravacao.atualizados, mantidos: gravacao.mantidos },
      repeticoes_anotadas: repeticoes,
      estados_gravados: estadosGravados,
      atraso_medio_s: atrasos.length ? Math.round(atrasos.reduce((soma, valor) => soma + valor, 0) / atrasos.length) : null,
    };
  });
};

/** Recalcula e grava as referências (perfis e placas com histórico) válidas para o dia de "agora". */
const executarReferencias = async (clientId, agora = new Date()) => {
  const inicioDia = inicioDoDiaLocal(agora.getTime());
  const desde = inicioDia - p.JANELA_REFERENCIA_DIAS * DIA_MS;
  return comRegistro(clientId, 'referencias', desde, inicioDia, async () => {
    const indice = await carregarIndice(clientId, desde - MARGEM_CARGA_DIAS * DIA_MS, inicioDia);
    const referencia = motor.criarReferenciaDoDia(indice, inicioDia, p);
    const gravacao = await dados.gravarReferencias(clientId, referencia, p.RETENCAO_REFERENCIAS_DIAS);
    const perfis = {};
    for (const agregado of Object.values(referencia.agregados)) perfis[agregado.perfil] = agregado.placas;
    return {
      // qualidade dos dados da janela: situação de cada tráfego e leituras de saída sem entrada
      dados: indice.resumo,
      perfis,
      placas_com_referencia_individual: referencia.individuais.length,
      referencias: gravacao,
    };
  });
};

/**
 * Reprocessa um período passado, sem usar dados posteriores a cada evento. Grava os alertas (substituindo os
 * ainda abertos) e não mexe no cursor nem nos estados do processamento incremental.
 */
const executarRetroativo = async (clientId, de, ate) => {
  const inicio = new Date(de).getTime();
  const fim = new Date(ate).getTime();
  return comRegistro(clientId, 'retroativo', inicio, fim, async () => {
    const indice = await carregarIndice(clientId, inicio - (p.JANELA_REFERENCIA_DIAS + p.DIAS_AQUECIMENTO + MARGEM_CARGA_DIAS) * DIA_MS, fim);
    const estados = new Map();
    motor.processarPeriodo(indice, inicio - p.DIAS_AQUECIMENTO * DIA_MS, inicio, estados, p);
    const resultado = motor.processarPeriodo(indice, inicio, fim, estados, p);
    const gravacao = await dados.gravarAlertas(clientId, resultado.alertas, { substituir: true });
    return {
      avaliacao: resultado.resumo,
      alertas: { gerados: resultado.alertas.length, novos: gravacao.novos, atualizados: gravacao.atualizados, mantidos: gravacao.mantidos },
    };
  });
};

/** Um ciclo do serviço para um cliente: incremental sempre; referências uma vez por dia. */
const executarCiclo = async (clientId, agora = new Date()) =>
  dados.comTrava(clientId, async () => {
    const resultado = { incremental: await executarIncremental(clientId, agora) };
    const ultima = await dados.ultimaExecucaoOk(clientId, 'referencias');
    if (!ultima || new Date(ultima.periodo_fim).getTime() < inicioDoDiaLocal(agora.getTime())) {
      resultado.referencias = await executarReferencias(clientId, agora);
    }
    return resultado;
  });

module.exports = { executarIncremental, executarReferencias, executarRetroativo, executarCiclo };
