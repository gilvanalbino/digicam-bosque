import { api } from '../utils/axios';

export const inserirWhiteList = (token, { placa, marca, modelo, nome, endereco, numero, complemento, client_id }) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = { placa: placa.toUpperCase(), marca, modelo, nome, endereco, numero, complemento, client_id };
    api
      .post(`/whiteList`, data, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const listarWhiteList = (token, client_id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/whiteList/client/${client_id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const obterWhiteList = (token, id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/whiteList/${id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const atualizarWhiteList = (
  token,
  { id, placa, marca, modelo, nome, endereco, numero, complemento, client_id }
) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = { id, placa: placa.toUpperCase(), marca, modelo, nome, endereco, numero, complemento, client_id };
    api
      .put(`/whiteList`, data, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const removerWhiteList = (token, id) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .delete(`/whiteList/${id}`, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
