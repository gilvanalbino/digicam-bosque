import { saveAs } from 'file-saver';
import { api } from '../utils/axios';

export const listagemTrafegos = (
  token,
  clienteId,
  dataHoraInicio,
  dataHoraFim,
  portaria_entrada_id,
  portaria_saida_id,
  texto_placa_nome
) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = { dataHoraInicio, dataHoraFim, portaria_entrada_id, portaria_saida_id, texto_placa_nome };
    console.log('------------------------');
    console.log(options);
    console.log(data);
    api
      .post(`/relatorios/listagemTrafego/client/${clienteId}`, data, options)
      .then((response) => {
        console.log(response.data);
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
    console.log('------------------------');
  });
};

export const listagemTrafegosExcel = (
  token,
  clienteId,
  dataHoraInicio,
  dataHoraFim,
  portaria_entrada_id,
  portaria_saida_id,
  texto_placa_nome
) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
      responseType: 'blob',
    };
    const data = { dataHoraInicio, dataHoraFim, portaria_entrada_id, portaria_saida_id, texto_placa_nome };
    api
      .post(`/relatorios/listagemTrafego/client/${clienteId}/excel`, data, options)
      .then((response) => {
        saveAs(response.data, 'digicam.xlsx');
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
};
