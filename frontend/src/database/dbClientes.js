import { api } from '../utils/axios';

export const inserirCliente = (
  token,
  { name, cpfCnpj, cep, address, number, district, city, state, type, active, entrada_automatica, tocar_alarme }
) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = {
      name,
      cpfCnpj,
      cep,
      address,
      number,
      district,
      city,
      state,
      type,
      active,
      entrada_automatica,
      tocar_alarme,
    };
    api
      .post(`/clients`, data, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const listarClientes = (token) => {
  return new Promise((resolve, reject) => {
    api
      .get('/clients', { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const obterCliente = (token, id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/clients/${id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const atualizarCliente = (
  token,
  { id, name, cpfCnpj, cep, address, number, district, city, state, type, active, entrada_automatica, tocar_alarme }
) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = {
      id,
      name,
      cpfCnpj,
      cep,
      address,
      number,
      district,
      city,
      state,
      type,
      active,
      entrada_automatica,
      tocar_alarme,
    };
    api
      .put(`/clients`, data, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const removerCliente = (token, id) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .delete(`/clients/${id}`, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

import axios from 'axios';

export const pesquisarCep = (cep) => {
  const url = `https://viacep.com.br/ws/${cep.replace('-', '').replace('.', '')}/json/`;
  console.log('url: ', url);
  return new Promise((resolve, reject) => {
    axios
      .get(url)
      .then((response) => {
        console.log(response);
        if (response.data.erro) {
          resolve(null);
        } else {
          resolve({
            address: response.data.logradouro,
            district: response.data.bairro,
            city: response.data.localidade,
            state: response.data.uf,
          });
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
};
