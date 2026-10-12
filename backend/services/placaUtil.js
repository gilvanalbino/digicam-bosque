'use strict';

// quantidade mínima de caracteres trocados, sobrando ou faltando entre duas placas (distância de edição);
// tolera os erros de OCR mais comuns: letra trocada, caractere lido a mais ou a menos.
// Mesma regra de frontend/src/utils/placaUtil.js
const diferencasPlacas = (placaA = '', placaB = '') => {
  let anterior = Array.from({ length: placaB.length + 1 }, (_, j) => j);
  for (let i = 1; i <= placaA.length; i++) {
    const atual = [i];
    for (let j = 1; j <= placaB.length; j++) {
      const troca = anterior[j - 1] + (placaA[i - 1] === placaB[j - 1] ? 0 : 1);
      atual[j] = Math.min(troca, anterior[j] + 1, atual[j - 1] + 1);
    }
    anterior = atual;
  }
  return anterior[placaB.length];
};

module.exports = { diferencasPlacas };
