import dayjs from 'dayjs';

export const formatarData = (data) => {
  if (data) {
    return new Date(data).toLocaleString('pt-BR', {});
  } else {
    return '';
  }
};

export const beginOfDay = (data) => {
  var d = dayjs(data);
  return new Date(d.startOf('day').format());
};

export const endOfDay = (data) => {
  var d = dayjs(data);
  return new Date(d.endOf('day').format());
};

const doisDigitos = (valor) => String(valor).padStart(2, '0');

/**
 * Tempo de permanência entre a entrada e a saída (ou agora) no formato HH:MM:SS
 */
export const calcularPermanencia = (dataEntrada, dataSaida) => {
  const fim = dataSaida ? new Date(dataSaida).getTime() : Date.now();
  const totalSegundos = Math.max(0, Math.floor((fim - new Date(dataEntrada).getTime()) / 1000));
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  return `${doisDigitos(horas)}:${doisDigitos(minutos)}:${doisDigitos(segundos)}`;
};

export const formatarHora = (data) => {
  if (data) {
    return new Date(data).toLocaleTimeString('pt-BR', {});
  } else {
    return '';
  }
};
