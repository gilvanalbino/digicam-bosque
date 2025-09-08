import { api } from '../utils/axios';

export const listarIdentificacoes = (token, portaria_id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/logIdentificacao/portaria/${portaria_id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const removerIdentificacao = (token, id) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .delete(`/logIdentificacao/${id}`, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const obterImagemCarro = (token, id) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .get(`/logIdentificacao/imagemCarro/${id}`, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
