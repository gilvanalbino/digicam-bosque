import { api } from '../utils/axios';

export const inserirUsuario = (token, { name, email, password, active, admin, admin_client, client_id }) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = { name, email, password, active, admin, admin_client, client_id };
    api
      .post(`/users`, data, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const listarUsuarios = (token, client_id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/users/client/${client_id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const obterUsuario = (token, id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/users/${id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const atualizarUsuario = (token, { id, name, email, password, active, admin, admin_client, client_id }) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = { id, name, email, password, active, admin, admin_client, client_id };
    api
      .put(`/users`, data, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const removerUsuario = (token, id) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .delete(`/users/${id}`, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
