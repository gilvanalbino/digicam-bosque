import { api } from '../utils/axios';

export const inserirBlackList = (token, { placa, marca, modelo, motivo, client_id }) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = { placa: placa.toUpperCase(), marca, modelo, motivo, client_id };
    api
      .post(`/blackList`, data, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const listarBlackList = (token, client_id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/blackList/client/${client_id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const obterBlackList = (token, id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/blackList/${id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const atualizarBlackList = (token, { id, placa, marca, modelo, motivo, client_id }) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = { id, placa: placa.toUpperCase(), marca, modelo, motivo, client_id };
    api
      .put(`/blackList`, data, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const removerBlackList = (token, id) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .delete(`/blackList/${id}`, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
