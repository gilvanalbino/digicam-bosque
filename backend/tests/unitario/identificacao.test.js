'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../../services/identificacao/regras');

const T0 = Date.parse('2026-11-21T12:00:00Z');
const s = (seg) => new Date(T0 + seg * 1000);

// ---------------- decisão da placa (tabela 7.2)

test('software desligado: vale a câmera, mesmo divergindo', () => {
  assert.deepEqual(
    r.decidirPlaca({ placaCamera: 'KRU2811', placaSoftware: 'KRU2B11', softwareLigado: false }),
    { placa: 'KRU2811', fonte: 'camera', divergente: true }
  );
});

test('software ligado: na divergência vale o software', () => {
  assert.deepEqual(
    r.decidirPlaca({ placaCamera: 'KRU2811', placaSoftware: 'KRU2B11', softwareLigado: true }),
    { placa: 'KRU2B11', fonte: 'software', divergente: true }
  );
});

test('software ligado: mesma placa não é divergência', () => {
  assert.deepEqual(
    r.decidirPlaca({ placaCamera: 'ABC1D23', placaSoftware: 'ABC1D23', softwareLigado: true }),
    { placa: 'ABC1D23', fonte: 'camera', divergente: false }
  );
});

test('só o software leu: vale o software', () => {
  assert.deepEqual(
    r.decidirPlaca({ placaCamera: null, placaSoftware: 'ABC1D23', softwareLigado: true }),
    { placa: 'ABC1D23', fonte: 'software', divergente: false }
  );
});

test('só a câmera leu: vale a câmera', () => {
  assert.deepEqual(
    r.decidirPlaca({ placaCamera: 'ABC1D23', placaSoftware: null, softwareLigado: true }),
    { placa: 'ABC1D23', fonte: 'camera', divergente: false }
  );
});

test('software com poucas leituras não vence a divergência', () => {
  assert.deepEqual(
    r.decidirPlaca({ placaCamera: 'LTK3307', placaSoftware: 'LTK3302', softwareLigado: true, leiturasSoftware: 1 }),
    { placa: 'LTK3307', fonte: 'camera', divergente: true }
  );
  assert.deepEqual(
    r.decidirPlaca({ placaCamera: 'PXD7105', placaSoftware: 'PXD7I05', softwareLigado: true, leiturasSoftware: 13 }),
    { placa: 'PXD7I05', fonte: 'software', divergente: true }
  );
});

test('placa da câmera fora do formato perde para o software mesmo com poucas leituras', () => {
  assert.deepEqual(
    r.decidirPlaca({ placaCamera: 'UWEOE33', placaSoftware: 'UWE0E33', softwareLigado: true, leiturasSoftware: 1 }),
    { placa: 'UWE0E33', fonte: 'software', divergente: true }
  );
  assert.equal(r.decidirPlaca({ placaCamera: 'LNH294', placaSoftware: 'LNH2940', softwareLigado: true, leiturasSoftware: 2 }).placa, 'LNH2940');
});

test('placa da câmera na red list nunca é trocada', () => {
  assert.deepEqual(
    r.decidirPlaca({ placaCamera: 'RED1A11', placaSoftware: 'RED1A17', softwareLigado: true, placaCameraNaRedList: true }),
    { placa: 'RED1A11', fonte: 'camera', divergente: true }
  );
});

// ---------------- casamento (7.1)

test('câmera casa com o software chegando: prefere a placa mais parecida', () => {
  const candidatas = [
    { id: 1, instante_software_inicio: s(0), instante_software: s(40), placa_software: 'XYZ9Z99' },
    { id: 2, instante_software_inicio: s(5), instante_software: null, placa_software: 'KRU2B11' },
  ];
  assert.equal(r.escolherSoftwareParaCamera(candidatas, s(6), 'KRU2811', T0 + 10000).id, 2);
});

test('câmera lida durante a espera na cancela ainda casa com a passagem do software', () => {
  // o veículo apareceu às 0 s, ficou 60 s parado e cruzou às 60 s; a câmera leu aos 45 s
  const candidatas = [{ id: 1, instante_software_inicio: s(0), instante_software: s(60), placa_software: 'ABC1D23' }];
  assert.equal(r.escolherSoftwareParaCamera(candidatas, s(45), 'ABC1D23').id, 1);
});

test('leitura da câmera fora da janela não casa', () => {
  const candidatas = [{ id: 1, instante_software_inicio: s(0), instante_software: s(10), placa_software: 'ABC1D23' }];
  assert.equal(r.escolherSoftwareParaCamera(candidatas, s(31), 'ABC1D23'), null);
  assert.equal(r.escolherSoftwareParaCamera(candidatas, s(-21), 'ABC1D23'), null);
});

test('software chegando depois casa com a leitura da câmera já gravada', () => {
  const candidatas = [
    { id: 7, instante_camera: s(2), placa_camera: 'LUE2069' },
    { id: 8, instante_camera: s(400), placa_camera: 'LUE2069' },
  ];
  const passagem = { instante_software_inicio: s(0), instante_software: s(30), placa_software: 'LUE2D69' };
  assert.equal(r.escolherCameraParaSoftware(candidatas, passagem).id, 7);
});

test('passagem do software ainda sem cruzamento fica aberta por 2 minutos', () => {
  const passagem = { instante_software_inicio: s(0), instante_software: null };
  const [de, ate] = r.janelaSoftware(passagem, T0);
  assert.equal(de, T0 - r.TOLERANCIA_MS);
  assert.equal(ate, T0 + r.PASSAGEM_ABERTA_MS + r.TOLERANCIA_MS);
});

// ---------------- duplicata (rastro partido no software)

test('segunda passagem do mesmo veículo na mesma câmera é duplicata', () => {
  const passagem = { id: 1520, instante_software_inicio: s(2.6), placa_software: 'SRO2I81' };
  const outras = [
    { id: 1519, instante_camera: s(0), instante_software_inicio: s(0.2), placa_camera: 'SRO2181', placa_software: 'SRO2I81', placa_final: 'SRO2I81', situacao: 'concluida' },
  ];
  assert.equal(r.acharDuplicata(passagem, outras).id, 1519);
});

test('mesma placa muito depois, outra placa ou registro descartado não é duplicata', () => {
  const passagem = { id: 9, instante_software_inicio: s(0), placa_software: 'ABC1D23' };
  assert.equal(r.acharDuplicata(passagem, [{ id: 1, instante_camera: s(-120), placa_final: 'ABC1D23' }]), null);
  assert.equal(r.acharDuplicata(passagem, [{ id: 2, instante_camera: s(5), placa_final: 'XYZ9Z99' }]), null);
  assert.equal(r.acharDuplicata(passagem, [{ id: 3, instante_software_inicio: s(3), placa_software: 'ABC1D23', situacao: 'descartada' }]), null);
});

test('a câmera lendo o mesmo veículo de novo em 1 s com 1 caractere diferente é leitura repetida', () => {
  const outras = [{ id: 1820, instante_camera: s(0), placa_camera: 'TTB1894', placa_software: 'TTB1B94', placa_final: 'TTB1B94' }];
  assert.equal(r.acharLeituraRepetida({ data: s(1), placa: 'TTB1B94' }, outras).id, 1820);
  assert.equal(r.acharLeituraRepetida({ data: s(15), placa: 'TTB1B94' }, outras), null);
  assert.equal(r.acharLeituraRepetida({ data: s(1), placa: 'KKK9K99' }, outras), null);
});

// ---------------- placa e direção

test('normalização e formato da placa', () => {
  assert.equal(r.normalizarPlaca(' abc-1d23 '), 'ABC1D23');
  assert.ok(r.placaValida('ABC1D23') && r.placaValida('ABC1234'));
  assert.ok(!r.placaValida('ACESOGLBA') && !r.placaValida('AB12345'));
});

test('direção esperada pela câmera', () => {
  assert.equal(r.direcaoEsperada('E'), 'entrada');
  assert.equal(r.direcaoEsperada('S'), 'saida');
});

// ---------------- configuração desenhada no cadastro (seção 4)

const configB2 = {
  linha: { p1: [0, 150], p2: [1100, 1080], ponto_dentro: [100, 900] },
  area: [[0, 0], [1920, 0], [1920, 760], [1680, 760], [1680, 1080], [0, 1080]],
};

test('configuração válida é completada com os padrões', () => {
  const v = r.validarConfigSoftware(configB2);
  assert.ok(v.ok, v.erros.join());
  assert.equal(v.config.qps, 5);
  assert.equal(v.config.linha.ancora, 'centro');
  assert.equal(v.config.detector.confianca, 0.25);
  assert.equal(v.config.canal, 101);
});

test('configuração inválida: pontos faltando, fora da imagem, linha curta, ponto em cima da linha', () => {
  assert.ok(!r.validarConfigSoftware({}).ok);
  assert.ok(!r.validarConfigSoftware({ linha: { p1: [0, 0], p2: [3000, 0], ponto_dentro: [10, 500] } }).ok);
  assert.ok(!r.validarConfigSoftware({ linha: { p1: [0, 0], p2: [50, 0], ponto_dentro: [10, 500] } }).ok);
  assert.ok(!r.validarConfigSoftware({ linha: { p1: [0, 500], p2: [1000, 500], ponto_dentro: [500, 505] } }).ok);
  assert.ok(!r.validarConfigSoftware({ ...configB2, area: [[0, 0], [10, 10]] }).ok);
});
