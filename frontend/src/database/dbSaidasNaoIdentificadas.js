import { api } from '../utils/axios';

export const listarSaidasRecentes = (token, client_id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/saidasNaoIdentificadas/client/${client_id}/recentes`, { headers: { authorization: token } })
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

export const desassociarSaida = (token, id) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .post(`/saidasNaoIdentificadas/${id}/desassociar`, {}, options)
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
