import { api } from '../utils/axios';

export const inserirCamera = (
  token,
  { nome, url, modelo, sentido, posicionamento, client_id, portaria_id, login, senha }
) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = { nome, url, modelo, sentido, posicionamento, client_id, portaria_id, login, senha };
    api
      .post(`/cameras`, data, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const listarCameras = (token, client_id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/cameras/client/${client_id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const obterCamera = (token, id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/cameras/${id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const atualizarCamera = (
  token,
  { id, nome, url, modelo, posicionamento, sentido, client_id, portaria_id, login, senha }
) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = { id, nome, url, modelo, sentido, posicionamento, client_id, portaria_id, login, senha };
    api
      .put(`/cameras`, data, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const removerCamera = (token, id) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .delete(`/cameras/${id}`, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const getPhoto = (token, id) => {
  return new Promise((resolve, reject) => {
    try {
      const options = {
        headers: { authorization: token },
      };
      api
        .get(`/cameras/${id}/photo`, options)
        .then((response) => {
          resolve(response.data);
        })
        .catch((error) => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
};

// identificação por software (docs/plano_identificacao_placas_software.md, seção 4)
export const obterFotoCamera = async (token, id) => {
  const response = await api.get(`/cameras/${id}/foto`, { headers: { authorization: token }, timeout: 30000 });
  return response.data.foto;
};

export const salvarSoftwareCamera = async (token, id, identificacao_software, config_software) => {
  const response = await api.put(
    `/cameras/${id}/software`,
    { identificacao_software, config_software },
    { headers: { authorization: token, 'Content-Type': 'application/json' } }
  );
  return response.data;
};
