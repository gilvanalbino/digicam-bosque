import { api } from '../utils/axios';

// erros do backend chegam com status 200 e o corpo do Boom (ver onPreResponse)
const pedir = (pedido) =>
  new Promise((resolve, reject) => {
    pedido
      .then((response) => {
        if (response.data && response.data.statusCode >= 400) {
          reject(response.data);
        } else {
          resolve(response.data);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });

export const listarAnomalias = (token, client_id, filtros = {}) =>
  pedir(api.get(`/anomalias/client/${client_id}`, { headers: { authorization: token }, params: filtros }));

export const obterAnomalia = (token, id) => pedir(api.get(`/anomalias/${id}`, { headers: { authorization: token } }));

export const obterHistoricoDaPlaca = (token, client_id, placa) =>
  pedir(api.get(`/anomalias/client/${client_id}/placa/${placa}`, { headers: { authorization: token } }));

export const obterMetricasAnomalias = (token, client_id, dias = 14) =>
  pedir(api.get(`/anomalias/client/${client_id}/metricas`, { headers: { authorization: token }, params: { dias } }));

export const revisarAnomalia = (token, id, resultado, motivo) =>
  pedir(
    api.post(
      `/anomalias/${id}/revisao`,
      { resultado, motivo },
      { headers: { authorization: token, 'Content-Type': 'application/json' } }
    )
  );
