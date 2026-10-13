// quantidade mínima de caracteres trocados, sobrando ou faltando entre duas placas (distância de edição);
// tolera os erros de OCR mais comuns: letra trocada, caractere lido a mais ou a menos
export const diferencasPlacas = (placaA = '', placaB = '') => {
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

const mesmoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// sugestão de associação entre uma entrada em travessia e uma saída sem entrada: com 1 caractere de
// diferença vale qualquer entrada (o sistema já associa sozinho esses casos na leitura da câmera); com 2,
// só entradas do mesmo dia da saída, e a decisão é do operador
export const placaSugerida = (entrada, saida) => {
  const diferencas = diferencasPlacas(entrada.placa, saida.placa);
  return diferencas <= 1 || (diferencas === 2 && mesmoDia(entrada.dataEntrada, saida.data));
};
