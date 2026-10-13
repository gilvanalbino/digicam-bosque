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

// com "page" nos filtros, a resposta é { rows, total, page, pageSize }; sem ele, o array completo
export const listarWhiteList = (token, client_id, filtros = {}) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/whiteList/client/${client_id}`, { headers: { authorization: token }, params: filtros })
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

// envia a planilha Excel (.xlsx); a resposta traz { incluidos, atualizados, inalterados, erros }
export const importarWhiteList = (token, client_id, arquivo) => {
  return new Promise((resolve, reject) => {
    const dados = new FormData();
    dados.append('arquivo', arquivo);
    api
      .post(`/whiteList/client/${client_id}/importar`, dados, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
