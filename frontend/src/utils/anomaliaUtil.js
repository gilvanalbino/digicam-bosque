// Textos e formatação dos alertas de anomalia (as evidências vêm do backend; aqui viram frases)

export const FAIXAS = {
  observacao: { titulo: 'Observação', classe: 'bg-amber-100 text-amber-800' },
  revisao: { titulo: 'Revisão', classe: 'bg-orange-100 text-orange-800' },
  prioridade_alta: { titulo: 'Prioridade alta', classe: 'bg-red-100 text-red-800' },
  normal: { titulo: 'Normal', classe: 'bg-gray-100 text-gray-700' },
};

export const STATUS = {
  ABERTA: { titulo: 'Aberta', classe: 'bg-sky-100 text-sky-800' },
  REVISADA: { titulo: 'Revisada', classe: 'bg-gray-100 text-gray-700' },
  DESCARTADA: { titulo: 'Descartada', classe: 'bg-gray-100 text-gray-500' },
  CONFIRMADA: { titulo: 'Relevante', classe: 'bg-indigo-100 text-indigo-800' },
};

export const DIMENSOES = { duracao: 'Permanência', frequencia: 'Frequência', horario: 'Horário' };

export const PERFIS = {
  novo: 'Placa nova',
  esporadico: 'Esporádico',
  recorrente: 'Recorrente',
  travessia_frequente: 'Travessia frequente',
  permanencia: 'Permanência longa',
  misto: 'Misto',
};

export const REFERENCIAS = {
  individual: 'histórico da própria placa',
  preliminar: 'histórico da própria placa (preliminar, menos de 30 viagens)',
  perfil: 'veículos de perfil parecido (histórico próprio insuficiente)',
};

const JANELAS = { h1: 'na última hora', h24: 'nas últimas 24 horas', d7: 'nos últimos 7 dias' };

// duração legível: 45 s, 12 min, 3 h 05 min, 2 d 4 h
export const formatarDuracao = (segundos) => {
  if (segundos === null || segundos === undefined) return '';
  if (segundos < 60) return `${Math.round(segundos)} s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h ${String(minutos % 60).padStart(2, '0')} min`;
  return `${Math.floor(horas / 24)} d ${horas % 24} h`;
};

const numero = (valor) => Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/**
 * Explicações do alerta, da dimensão que mais pesou para a que menos pesou.
 * Cada item: { dimensao, score, texto, referencia }.
 */
export const explicarAnomalia = (anomalia) => {
  const evidencias = anomalia.evidencias || {};
  const itens = [];

  const duracao = evidencias.duracao;
  if (duracao && duracao.score > 0) {
    const comparacao = duracao.referencia === 'perfil'
      ? `acima do que 95% dos veículos de perfil parecido ficam (${formatarDuracao(duracao.p95_s)})`
      : `${duracao.sentido === 'abaixo' ? 'bem abaixo' : 'bem acima'} da mediana das ${duracao.amostra} viagens anteriores (${formatarDuracao(duracao.mediana_s)})`;
    itens.push({
      dimensao: 'duracao', score: duracao.score, referencia: duracao.referencia,
      texto: `Permaneceu ${formatarDuracao(duracao.valor_s)}, ${comparacao}.`,
    });
  }

  const frequencia = evidencias.frequencia;
  if (frequencia && frequencia.score > 0) {
    const janela = frequencia.janelas[frequencia.principal];
    const habitual = janela.mediana !== undefined
      ? `o habitual é ${numero(janela.mediana)}`
      : `95% dos veículos de perfil parecido têm até ${numero(janela.p95)}`;
    itens.push({
      dimensao: 'frequencia', score: frequencia.score, referencia: frequencia.referencia,
      texto: `${janela.valor} passagens ${JANELAS[frequencia.principal]}; ${habitual}.`,
    });
  }

  const horario = evidencias.horario;
  if (horario && horario.score > 0) {
    const tipo = horario.tipo_dia === 'fim_de_semana' ? 'fim de semana' : 'dia útil';
    const quem = horario.referencia === 'perfil' ? 'veículos de perfil parecido' : 'este veículo';
    itens.push({
      dimensao: 'horario', score: horario.score, referencia: horario.referencia,
      texto: `Passou entre ${horario.hora}h e ${horario.hora + 1}h em ${tipo}, faixa incomum para ${quem} (${numero(horario.probabilidade * 100)}% das passagens anteriores).`,
    });
  }

  const persistencia = evidencias.persistencia;
  if (persistencia && persistencia.score > 0) {
    itens.push({
      dimensao: 'persistencia', score: persistencia.score, referencia: null,
      texto: `Desvios em ${persistencia.dias_com_desvio} dias distintos: a mudança vem se repetindo.`,
    });
  }
  return itens.sort((a, b) => b.score - a.score);
};

// frase curta para a lista: a explicação da dimensão principal
export const resumirAnomalia = (anomalia) => {
  const itens = explicarAnomalia(anomalia);
  return itens.length ? itens[0].texto : '';
};
