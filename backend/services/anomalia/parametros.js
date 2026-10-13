'use strict';

// Parâmetros iniciais do detector de anomalias (docs/plano_anomalia.md). Todos são hipóteses a calibrar na
// validação; qualquer mudança que altere resultados deve vir com nova VERSAO_MODELO.
module.exports = {
  VERSAO_MODELO: '1.0.0',

  // janela do histórico usado como referência de cada evento
  JANELA_REFERENCIA_DIAS: 90,

  // viagem válida: duração máxima aceita no cálculo de duração (definida na auditoria de dados)
  TETO_DURACAO_S: 24 * 3600,
  // leitura de saída até este tempo antes da saída do tráfego: mesmo veículo lido por duas câmeras de saída
  TOLERANCIA_SAIDA_DUPLA_S: 600,

  // referência individual: mínimos de amostra
  MIN_VIAGENS_INDIVIDUAL: 10,
  MIN_VIAGENS_CONFIAVEL: 30,
  MIN_DIAS_ATIVOS_FREQUENCIA: 10,
  MIN_SEMANAS_FREQUENCIA: 6,
  MIN_HORAS_ATIVAS_FREQUENCIA: 10,
  MIN_PASSAGENS_HORARIO: 20,

  // perfis por regras
  MIN_PASSAGENS_PERFIL: 10,
  LIMITE_TRAVESSIA_S: 600,
  PROPORCAO_PERFIL: 0.75,

  // duração: dispersão mínima, para o MAD zero ou muito pequeno
  DISPERSAO_MINIMA_FRACAO_MEDIANA: 0.25,
  DISPERSAO_MINIMA_S: 60,

  // frequência: diferença absoluta mínima, em passagens, para a variação contar
  DIFERENCA_MINIMA_1H: 4,
  DIFERENCA_MINIMA_24H: 4,
  DIFERENCA_MINIMA_7D: 6,

  // uma dimensão calculada com a referência do perfil (histórico insuficiente) não passa destes valores
  // (o horário do perfil fica abaixo do score mínimo de alerta: só reforça outra dimensão)
  TETO_SCORE_PERFIL: { duracao: 59, frequencia: 59, horario: 25 },

  // score
  PESOS: { duracao: 35, frequencia: 25, horario: 20 },
  FATOR_REFORCO: 0.5,
  FATOR_PERSISTENCIA: 0.3,
  SCORE_MINIMO_ALERTA: 30,

  // anomalia que persiste: nos dias seguintes a um alerta da mesma placa e dimensão, só nasce outro alerta se
  // o score subir pelo menos este tanto; senão a repetição é anotada no alerta existente
  CARENCIA_REPETICAO_DIAS: 7,
  AUMENTO_PARA_NOVO_ALERTA: 10,

  // mudança persistente (EWMA)
  LAMBDA: 0.2,
  MEIA_VIDA_EWMA_DIAS: 14,
  REINICIO_EWMA_DIAS: 45,
  MIN_DIAS_PERSISTENCIA: 3,
  SCORE_MINIMO_DESVIO: 30,

  // processamento
  MARGEM_CONSOLIDACAO_MIN: 10,
  // dias anteriores usados só para formar o estado (EWMA) na primeira execução; não geram alerta
  DIAS_AQUECIMENTO: 14,
  RETENCAO_REFERENCIAS_DIAS: 180,
};
