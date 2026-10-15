'use strict';
// Testes unitários da correção de placa pela green list.
//   npm run test:unitario

const test = require('node:test');
const assert = require('node:assert/strict');

const { placaCorrigidaPelaGreenList } = require('../../services/placaUtil');

const greenList = ['ABC1D23', 'XYZ9876', 'QWE4R56', 'KZM7171'];

test('corrige troca típica de leitura', () => {
  assert.equal(placaCorrigidaPelaGreenList('ABC1O23', greenList), 'ABC1D23'); // O/D
  assert.equal(placaCorrigidaPelaGreenList('ABC1023', greenList), 'ABC1D23'); // 0/D
  assert.equal(placaCorrigidaPelaGreenList('XYZ9B76', greenList), 'XYZ9876'); // B/8
  assert.equal(placaCorrigidaPelaGreenList('KZM7I71', greenList), 'KZM7171'); // I/1
  assert.equal(placaCorrigidaPelaGreenList('QWE4R5G', greenList), 'QWE4R56'); // G/6
});

test('não corrige troca que não é confusão típica (pode ser outro carro)', () => {
  assert.equal(placaCorrigidaPelaGreenList('ABC1D24', greenList), null);
  assert.equal(placaCorrigidaPelaGreenList('XYZ9870', greenList), null);
  assert.equal(placaCorrigidaPelaGreenList('ABC1E23', greenList), null);
});

test('não corrige caractere a mais ou a menos', () => {
  assert.equal(placaCorrigidaPelaGreenList('XYZ98761', greenList), null);
  assert.equal(placaCorrigidaPelaGreenList('XYZ976', greenList), null);
});

test('não corrige placa que já está na lista', () => {
  assert.equal(placaCorrigidaPelaGreenList('ABC1D23', greenList), null);
});

test('não corrige com 2 trocas, mesmo típicas', () => {
  assert.equal(placaCorrigidaPelaGreenList('ABCI023', greenList), null);
});

test('não corrige quando mais de uma placa da lista se encaixa', () => {
  assert.equal(placaCorrigidaPelaGreenList('ABC1O23', ['ABC1D23', 'ABC1Q23']), null);
});

test('placa repetida na lista não conta como ambígua', () => {
  assert.equal(placaCorrigidaPelaGreenList('ABC1O23', ['ABC1D23', 'ABC1D23']), 'ABC1D23');
});

test('placa vazia ou lista vazia não corrige', () => {
  assert.equal(placaCorrigidaPelaGreenList('', greenList), null);
  assert.equal(placaCorrigidaPelaGreenList('ABC1O23', []), null);
});
