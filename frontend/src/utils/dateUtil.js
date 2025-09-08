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
