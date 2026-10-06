import { api } from '../utils/axios';

export const listarSaidasNaoIdentificadas = (token, client_id, filtros = {}) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/saidasNaoIdentificadas/client/${client_id}`, { headers: { authorization: token }, params: filtros })
      .then((response) => {
        // erros do backend chegam com status 200 e o corpo do Boom (ver onPreResponse)
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
};

export const arquivarSaidaNaoIdentificada = (token, id, motivo) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .post(`/saidasNaoIdentificadas/${id}/arquivar`, { motivo }, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const associarSaidaNaoIdentificada = (token, id, trafegoId) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .post(`/saidasNaoIdentificadas/${id}/associar/${trafegoId}`, {}, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
