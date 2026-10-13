'use strict';
// Testes unitários das funções puras do detector de anomalias.
//   npm run test:unitario      (usa o node:test nativo; TZ fixa para os testes de horário)
process.env.TZ = 'America/Bahia';

const test = require('node:test');
const assert = require('node:assert/strict');

const est = require('../../services/anomalia/estatistica');
const prep = require('../../services/anomalia/preparacao');
const motor = require('../../services/anomalia/motor');
const p = require('../../services/anomalia/parametros');

const DIA = prep.DIA_MS;
const MIN = 60000;
// 12/10/2026 é segunda-feira; horários abaixo no fuso do teste (UTC-3)
const base = new Date(2026, 9, 12, 0, 0, 0).getTime();
const em = (dias, hora = 10, minuto = 0) => new Date(base + dias * DIA + hora * 3600000 + minuto * MIN);
const perto = (valor, esperado, tolerancia = 0.01) => assert.ok(Math.abs(valor - esperado) <= tolerancia, `${valor} ≠ ${esperado}`);

let proximoId = 1;
const trafego = (placa, entrada, minutos, extras = {}) => ({
  id: proximoId++, placa, placa_saida: placa, dataEntrada: entrada,
  dataSaida: minutos === null ? null : new Date(entrada.getTime() + minutos * MIN),
  identificador_placa_saida: minutos === null ? null : `s-${proximoId}`,
  portaria_entrada_id: 1, portaria_saida_id: 2, in_whitelist: 0, in_blacklist: 0, ...extras,
});
const indiceDe = (trafegos, saidas = []) =>
  prep.montarIndice({ trafegos, saidas, portariaDaCamera: new Map([[9, 2]]) }, { tetoDuracaoS: p.TETO_DURACAO_S });

// ---------------------------------------------------------------- estatística
test('mediana, percentil e MAD', () => {
  assert.equal(est.mediana([3, 1, 2]), 2);
  assert.equal(est.mediana([1, 2, 3, 4]), 2.5);
  assert.equal(est.mediana([]), null);
  assert.equal(est.percentil([10, 20, 30, 40, 50], 0.25), 20);
  // o valor extremo não desloca a mediana nem o MAD
  assert.equal(est.mad([1, 2, 3, 4, 100]), 1);
  assert.equal(est.mad([5, 5, 5, 5]), 0);
});

test('desvio robusto e curva de normalização', () => {
  perto(est.desvioRobusto(130, 100, 10), 2.0235);
  assert.equal(est.normalizarDesvio(0), 0);
  assert.equal(est.normalizarDesvio(2), 0);
  assert.equal(est.normalizarDesvio(2.5), 30);
  assert.equal(est.normalizarDesvio(3), 60);
  assert.equal(est.normalizarDesvio(4.5), 80);
  assert.equal(est.normalizarDesvio(6), 100);
  assert.equal(est.normalizarDesvio(50), 100);
  // reduções contam como aumentos
  assert.equal(est.normalizarDesvio(-3), 60);
});

test('pontuação por percentis e por raridade', () => {
  assert.equal(est.scorePorPercentis(5, 10, 20), 0);
  assert.equal(est.scorePorPercentis(15, 10, 20), 30);
  assert.equal(est.scorePorPercentis(20, 10, 20), 60);
  assert.equal(est.scorePorPercentis(30, 10, 20), 80);
  assert.equal(est.scorePorPercentis(99, 10, 20), 100);
  assert.equal(est.scorePorPercentis(5, null, null), 0);
  assert.equal(est.scoreRaridade(0.5), 0);
  assert.equal(est.scoreRaridade(0.02), 0);
  perto(est.scoreRaridade(0.005), 60);
  assert.equal(est.scoreRaridade(0), 100);
});

test('probabilidade suavizada da faixa horária', () => {
  const histograma = new Array(24).fill(0);
  histograma[8] = 20;
  // hora habitual, hora vizinha e hora nunca vista
  perto(est.probabilidadeHora(histograma, 8), 21 / 64);
  perto(est.probabilidadeHora(histograma, 9), 11 / 64);
  perto(est.probabilidadeHora(histograma, 3), 1 / 64);
  // sem histórico nenhum a estimativa não zera
  perto(est.probabilidadeHora(new Array(24).fill(0), 3), 1 / 24);
});

test('EWMA com intervalos irregulares', () => {
  assert.equal(est.ewma(null, 100, 0.2), 20);
  assert.equal(est.ewma(50, 100, 0.2), 60);
  // 14 dias sem observação (uma meia-vida): o valor anterior pesa a metade
  assert.equal(est.ewma(50, 100, 0.2, 14, 14), 40);
  assert.equal(est.ewma(50, 0, 0.2, 14, 14), 20);
});

test('composição do score: maior dimensão com reforço e persistência', () => {
  const opcoes = { pesos: p.PESOS, fatorReforco: 0.5, fatorPersistencia: 0.3 };
  // uma dimensão extrema sozinha já chega à faixa de revisão
  let r = est.comporScore({ duracao: 70, frequencia: 0, horario: 0 }, 0, opcoes);
  assert.equal(r.score, 70);
  assert.equal(r.principal, 'duracao');
  // as outras dimensões reforçam: reforço = (25×60 + 20×60) / 45 = 60 → 70 + 30 × 0,5 × 0,6
  r = est.comporScore({ duracao: 70, frequencia: 60, horario: 60 }, 0, opcoes);
  perto(r.score, 79);
  // a persistência sobe o que falta para 100
  r = est.comporScore({ duracao: 70, frequencia: 0, horario: 0 }, 100, opcoes);
  perto(r.score, 79);
  // dimensão não calculada não entra na conta
  r = est.comporScore({ duracao: null, frequencia: 40, horario: null }, 0, opcoes);
  assert.equal(r.score, 40);
  assert.equal(r.principal, 'frequencia');
  assert.equal(est.comporScore({ duracao: null, frequencia: null, horario: null }, 0, opcoes).score, null);
  assert.equal(est.faixaDoScore(29.9), 'normal');
  assert.equal(est.faixaDoScore(30), 'observacao');
  assert.equal(est.faixaDoScore(60), 'revisao');
  assert.equal(est.faixaDoScore(80), 'prioridade_alta');
  assert.equal(est.faixaDoScore(null), 'sem_dados');
});

// ---------------------------------------------------------------- preparação
test('passagens das três origens, sem duplicar a saída associada', () => {
  const i = indiceDe(
    [trafego('ABC1D23', em(0), 5), trafego('ABC1D23', em(1), null), trafego('XYZ1A11', em(0), null, { dataSaida: em(0, 11) })],
    [
      { id: 1, placa: 'ABC1D23', data: em(2), camera_id: 9, status: 'pendente' },
      { id: 2, placa: 'ABC1D23', data: em(0, 10, 5), camera_id: 9, status: 'associada' },
      { id: 3, placa: 'UNKNOWN', data: em(2), camera_id: 9, status: 'pendente' },
    ]
  );
  const abc = i.porPlaca.get('ABC1D23');
  // 2 entradas + 1 saída do tráfego + 1 saída sem entrada; a "associada" não conta de novo
  assert.equal(abc.passagens.length, 4);
  assert.deepEqual(abc.passagens.map((x) => x.sentido), ['E', 'S', 'E', 'S']);
  assert.equal(abc.passagens[3].portaria, 2);
  // baixa manual: a entrada é passagem, a saída não (nenhuma câmera leu)
  assert.equal(i.porPlaca.get('XYZ1A11').passagens.length, 1);
  assert.equal(i.resumo.viagens.valida, 1);
  // viagem aberta e baixa manual contam juntas, como entrada sem saída
  assert.equal(i.resumo.viagens.sem_saida, 2);
  assert.equal('aberta' in i.resumo.viagens, false);
  assert.equal('baixa_manual' in i.resumo.viagens, false);
  assert.equal(i.resumo.placas_invalidas, 1);
  assert.equal(i.porPlaca.has('UNKNOWN'), false);
});

test('viagem inválida: passagem intermediária, teto e saída antes da entrada', () => {
  const longa = trafego('AAA1A11', em(0), 3 * 24 * 60);
  const i = indiceDe(
    [
      longa,
      // outra entrada da mesma placa no meio: a saída foi casada com a entrada antiga
      trafego('AAA1A11', em(1), null),
      trafego('BBB1B11', em(0), 26 * 60),
      trafego('CCC1C11', em(0), -5),
      trafego('DDD1D11', em(0), 4),
    ],
    [
      // mesma placa lida por outra câmera de saída 2 minutos antes: mesma travessia, viagem continua válida
      { id: 1, placa: 'DDD1D11', data: em(0, 10, 2), camera_id: 9, status: 'pendente' },
    ]
  );
  assert.equal(i.resumo.viagens.passagem_intermediaria, 1);
  assert.equal(i.resumo.viagens.acima_do_teto, 1);
  assert.equal(i.resumo.viagens.saida_antes_da_entrada, 1);
  assert.equal(i.resumo.viagens.valida, 1);
  assert.equal(i.porPlaca.get('AAA1A11').viagens.length, 0);
  assert.equal(i.porPlaca.get('DDD1D11').viagens[0].duracao, 240);
});

test('saída com placa diferente conta para a placa da entrada', () => {
  const i = indiceDe([trafego('ABC1D23', em(0), 5, { placa_saida: 'ABC1D28' })]);
  assert.equal(i.porPlaca.has('ABC1D28'), false);
  assert.equal(i.porPlaca.get('ABC1D23').passagens.length, 2);
  assert.equal(i.porPlaca.get('ABC1D23').viagens[0].placasDiferentes, true);
});

test('placa válida e vizinha de placa frequente', () => {
  assert.equal(prep.placaValida('ABC1234'), true);
  assert.equal(prep.placaValida('ABC1D23'), true);
  assert.equal(prep.placaValida('UNKNOWN'), false);
  assert.equal(prep.placaValida('AB12345'), false);
  const indice = prep.criarIndiceVizinhas(['ABC1D23']);
  assert.equal(prep.ehVizinhaDeFrequente('ABC1D28', indice), true); // troca
  assert.equal(prep.ehVizinhaDeFrequente('ABC1D2', indice), true); // falta
  assert.equal(prep.ehVizinhaDeFrequente('ABC1D233', indice), true); // sobra
  assert.equal(prep.ehVizinhaDeFrequente('ABC1D23', indice), false); // a própria
  assert.equal(prep.ehVizinhaDeFrequente('ABC9D28', indice), false); // duas trocas
});

// ---------------------------------------------------------------- motor
// placa com uma travessia de 2 minutos às 8h em cada um dos 40 dias úteis anteriores
const historicoRegular = (placa, dias = 40, minutos = 2) => {
  const lista = [];
  for (let d = 1; lista.length < dias; d++) {
    const data = em(-d, 8);
    if (data.getDay() !== 0 && data.getDay() !== 6) lista.push(trafego(placa, data, minutos));
  }
  return lista;
};
const avaliar = (trafegos, saidas, placa, instante, estado) => {
  const i = indiceDe(trafegos, saidas);
  const registro = i.porPlaca.get(placa);
  const evento = registro.passagens.find((x) => x.t === instante.getTime());
  const referencia = motor.criarReferenciaDoDia(i, prep.inicioDoDiaLocal(evento.t), p);
  return motor.avaliarEvento(evento, registro, referencia, estado, p);
};

test('perfis por regras', () => {
  assert.equal(motor.perfilDaPlaca(0, [], p), 'novo');
  assert.equal(motor.perfilDaPlaca(5, [], p), 'esporadico');
  assert.equal(motor.perfilDaPlaca(40, [100, 120], p), 'recorrente');
  assert.equal(motor.perfilDaPlaca(40, new Array(12).fill(120), p), 'travessia_frequente');
  assert.equal(motor.perfilDaPlaca(40, new Array(12).fill(7200), p), 'permanencia');
  assert.equal(motor.perfilDaPlaca(40, [...new Array(6).fill(120), ...new Array(6).fill(7200)], p), 'misto');
});

test('duração: viagem habitual não pontua e permanência longa pontua', () => {
  const historico = historicoRegular('ABC1D23');
  let r = avaliar([...historico, trafego('ABC1D23', em(0, 8), 2)], [], 'ABC1D23', em(0, 8, 2));
  assert.equal(r.dimensoes.duracao, 0);
  assert.equal(r.score, 0);
  assert.equal(r.qualidade.referencias.duracao, 'individual');
  assert.equal(r.qualidade.perfil, 'travessia_frequente');

  r = avaliar([...historico, trafego('ABC1D23', em(0, 8), 60)], [], 'ABC1D23', em(0, 9));
  assert.equal(r.dimensoes.duracao, 100);
  assert.ok(r.motivos.includes('DURACAO_ACIMA'));
  assert.ok(r.score >= 80);
  assert.equal(r.evidencias.duracao.mediana_s, 120);
  assert.equal(r.evidencias.duracao.valor_s, 3600);
  assert.equal(r.evidencias.composicao.principal, 'duracao');
});

test('duração: MAD zero usa a dispersão mínima, e a viagem avaliada fica fora da própria referência', () => {
  const historico = historicoRegular('ABC1D23');
  const r = avaliar([...historico, trafego('ABC1D23', em(0, 8), 60)], [], 'ABC1D23', em(0, 9));
  assert.equal(r.evidencias.duracao.mad_s, 0);
  assert.equal(r.evidencias.duracao.dispersao_s, p.DISPERSAO_MINIMA_S);
  // 40 viagens no histórico: a 41ª (avaliada) não entra
  assert.equal(r.evidencias.duracao.amostra, 40);
});

test('duração: redução expressiva também é registrada', () => {
  const historico = historicoRegular('ABC1D23', 40, 120);
  const r = avaliar([...historico, trafego('ABC1D23', em(0, 8), 2)], [], 'ABC1D23', em(0, 8, 2));
  assert.ok(r.dimensoes.duracao >= 30);
  assert.equal(r.evidencias.duracao.sentido, 'abaixo');
  assert.ok(r.motivos.includes('DURACAO_ABAIXO'));
});

test('frequência: muitas passagens no dia para quem passa duas vezes', () => {
  const historico = historicoRegular('ABC1D23');
  const hoje = [0, 1, 2, 3, 4, 5].map((n) => trafego('ABC1D23', em(0, 8, n * 5), 2));
  const r = avaliar([...historico, ...hoje], [], 'ABC1D23', em(0, 8, 27));
  assert.equal(r.evidencias.frequencia.janelas.h24.valor, 12);
  assert.equal(r.evidencias.frequencia.janelas.h24.mediana, 2);
  assert.ok(r.dimensoes.frequencia >= 60);
  assert.ok(r.motivos.some((motivo) => motivo.startsWith('FREQUENCIA')));
});

test('horário: passagem de madrugada para quem só passa de manhã', () => {
  const historico = historicoRegular('ABC1D23');
  let r = avaliar([...historico, trafego('ABC1D23', em(0, 3), null)], [], 'ABC1D23', em(0, 3));
  // 80 passagens no histórico, nenhuma perto das 3h: probabilidade 1/184
  assert.equal(r.evidencias.horario.probabilidade, 0.0054);
  assert.ok(r.dimensoes.horario >= 50);
  assert.ok(r.motivos.includes('HORARIO_INCOMUM'));
  assert.equal(r.evidencias.horario.hora, 3);
  assert.equal(r.evidencias.horario.tipo_dia, 'dia_util');
  r = avaliar([...historico, trafego('ABC1D23', em(0, 8), null)], [], 'ABC1D23', em(0, 8));
  assert.equal(r.dimensoes.horario, 0);
});

test('amostra insuficiente: usa o perfil, limita a pontuação e sinaliza', () => {
  // população de placas esporádicas com travessias curtas, para formar a referência do perfil
  const populacao = [];
  for (let n = 0; n < 60; n++) {
    const placa = `ESP${String(1000 + n)}`;
    populacao.push(trafego(placa, em(-2 - (n % 20), 9 + (n % 8)), 2 + (n % 4)));
    populacao.push(trafego(placa, em(-30 - (n % 20), 9 + (n % 8)), 2 + (n % 4)));
  }
  const r = avaliar([...populacao, trafego('NOV1A11', em(0, 10), 600)], [], 'NOV1A11', em(0, 20));
  assert.equal(r.qualidade.perfil, 'novo');
  assert.equal(r.qualidade.historico_insuficiente, true);
  assert.equal(r.qualidade.referencias.duracao, 'perfil');
  assert.ok(r.dimensoes.duracao > 0);
  assert.ok(r.dimensoes.duracao <= p.TETO_SCORE_PERFIL.duracao);
  assert.ok(r.score < 60);
});

test('provável erro de leitura não gera alerta', () => {
  const historico = historicoRegular('ABC1D23');
  const r = avaliar([...historico, trafego('ABC1D28', em(0, 3), null)], [], 'ABC1D28', em(0, 3));
  assert.deepEqual(r, { ignorado: 'provavel_erro_leitura' });
});

test('mudança persistente só conta com desvios em dias distintos', () => {
  const evento = (dia) => ({ t: base + dia * DIA, dia });
  let { estado, persistencia } = motor.atualizarEstado(null, evento(0), 80, 0, p);
  assert.equal(persistencia, 0);
  // segundo evento no mesmo dia não vira novo dia de desvio
  ({ estado, persistencia } = motor.atualizarEstado(estado, evento(0), 80, 0, p));
  assert.equal(estado.dias.length, 1);
  ({ estado, persistencia } = motor.atualizarEstado(estado, evento(1), 80, 0, p));
  assert.equal(persistencia, 0);
  ({ estado, persistencia } = motor.atualizarEstado(estado, evento(2), 80, 0, p));
  assert.equal(estado.dias.length, 3);
  assert.ok(persistencia > 30);
  // um intervalo longo reinicia a série
  ({ estado, persistencia } = motor.atualizarEstado(estado, evento(2 + p.REINICIO_EWMA_DIAS + 1), 80, 0, p));
  assert.equal(estado.dias.length, 1);
  assert.equal(persistencia, 0);
});

test('processamento: um alerta por placa e dia, repetições anotadas e resultado reproduzível', () => {
  const historico = historicoRegular('ABC1D23');
  const anomalas = [
    trafego('ABC1D23', em(0, 8), 60), trafego('ABC1D23', em(0, 14), 90),
    trafego('ABC1D23', em(1, 8), 60), trafego('ABC1D23', em(2, 8), 60),
  ];
  const rodar = () => {
    const i = indiceDe([...historico, ...anomalas]);
    return motor.processarPeriodo(i, base, base + 3 * DIA, new Map(), p);
  };
  const r = rodar();
  // dois eventos anômalos no dia 0 viram um alerta; os dias seguintes viram repetições dele
  assert.equal(r.alertas.length, 1);
  assert.equal(r.alertas[0].chave_veiculo, 'ABC1D23');
  assert.equal(r.alertas[0].dia, '2026-10-12');
  // as duas saídas com permanência longa e a entrada das 14h, horário em que a placa nunca passou
  assert.equal(r.alertas[0].evidencias.eventos_no_dia, 3);
  assert.equal(r.alertas[0].evidencias.repeticoes.length, 2);
  assert.equal(r.resumo.repetidos, 2);
  // mesma versão e mesmos dados: mesmo resultado
  assert.deepEqual(JSON.parse(JSON.stringify(rodar().alertas)), JSON.parse(JSON.stringify(r.alertas)));
});

test('processamento: repetição de alerta já gravado é devolvida para anotação', () => {
  const historico = historicoRegular('ABC1D23');
  const i = indiceDe([...historico, trafego('ABC1D23', em(1, 8), 60)]);
  const recentes = [{ id: 77, chave_veiculo: 'ABC1D23', principal: 'duracao', dia: '2026-10-12', score: 100 }];
  const r = motor.processarPeriodo(i, base + DIA, base + 2 * DIA, new Map(), p, { recentes });
  assert.equal(r.alertas.length, 0);
  assert.equal(r.repeticoes.length, 1);
  assert.equal(r.repeticoes[0].id, 77);
  assert.equal(r.repeticoes[0].dia, '2026-10-13');
});

test('processamento: não usa dados posteriores ao evento', () => {
  const historico = historicoRegular('ABC1D23');
  const hoje = trafego('ABC1D23', em(0, 8), 60);
  const depois = [1, 2, 3, 4, 5].map((d) => trafego('ABC1D23', em(d, 8), 60));
  const semFuturo = motor.processarPeriodo(indiceDe([...historico, hoje]), base, base + DIA, new Map(), p);
  const comFuturo = motor.processarPeriodo(indiceDe([...historico, hoje, ...depois]), base, base + DIA, new Map(), p);
  assert.deepEqual(JSON.parse(JSON.stringify(comFuturo.alertas)), JSON.parse(JSON.stringify(semFuturo.alertas)));
});
