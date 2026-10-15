import { api } from '../utils/axios';

// o backend devolve os erros (validação, permissão) com HTTP 200 e o erro no corpo
const respostaOuErro = (response, resolve, reject) => {
  const erro = response.data && response.data.statusCode >= 400 ? response.data : null;
  if (erro) {
    reject(new Error((erro.payload && erro.payload.message) || 'Erro salvando usuário'));
  } else {
    resolve(response.data);
  }
};

export const inserirUsuario = (token, { name, email, password, active, admin, admin_client, client_id }) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = { name, email, password, active, admin, admin_client, client_id };
    api
      .post(`/users`, data, options)
      .then((response) => {
        respostaOuErro(response, resolve, reject);
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
        respostaOuErro(response, resolve, reject);
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

// troca a senha do próprio usuário logado; a resposta é { status: 'OK' } ou { status: 'ERROR', message }
export const alterarMinhaSenha = (token, senhaAtual, novaSenha) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .post(`/users/me/senha`, { senhaAtual, novaSenha }, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
