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

// caracteres que a câmera costuma confundir entre si; só essas trocas são corrigidas pela green list
const GRUPOS_CONFUSAO = ['I1', 'O0DQ', 'B8', 'S5', 'Z2', 'G6'];
const GRUPO_DO_CARACTERE = new Map(
  GRUPOS_CONFUSAO.flatMap((grupo, indice) => [...grupo].map((caractere) => [caractere, indice]))
);

// placas de mesmo tamanho que diferem em uma única posição, com um par de caracteres que a câmera confunde
const diferemPorConfusaoDeLeitura = (placaA, placaB) => {
  if (placaA.length !== placaB.length) {
    return false;
  }
  const posicoes = [...placaA].map((_, i) => i).filter((i) => placaA[i] !== placaB[i]);
  if (posicoes.length !== 1) {
    return false;
  }
  const grupo = GRUPO_DO_CARACTERE.get(placaA[posicoes[0]]);
  return grupo !== undefined && grupo === GRUPO_DO_CARACTERE.get(placaB[posicoes[0]]);
};

/**
 * Placa da green list para a qual a leitura da câmera deve ser corrigida: a única placa cadastrada que difere
 * da lida em 1 caractere, sendo a troca uma confusão típica de leitura (I/1, O/0/D/Q, B/8, S/5, Z/2, G/6).
 * Retorna null quando a placa lida já está na lista, quando nenhuma placa se encaixa ou quando mais de uma se
 * encaixa (não há como saber qual é a certa).
 */
const placaCorrigidaPelaGreenList = (placa, placasGreenList) => {
  if (!placa || placasGreenList.includes(placa)) {
    return null;
  }
  const candidatas = [...new Set(placasGreenList.filter((placaLista) => diferemPorConfusaoDeLeitura(placaLista, placa)))];
  return candidatas.length === 1 ? candidatas[0] : null;
};

module.exports = { diferencasPlacas, placaCorrigidaPelaGreenList };
