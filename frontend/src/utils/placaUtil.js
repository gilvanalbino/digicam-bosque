// quantidade de posições diferentes entre duas placas (tolerância a erro de OCR)
export const diferencasPlacas = (placaA = '', placaB = '') => {
  const tamanho = Math.max(placaA.length, placaB.length);
  let diff = 0;
  for (let i = 0; i < tamanho; i++) {
    if (placaA[i] !== placaB[i]) diff++;
  }
  return diff;
};
