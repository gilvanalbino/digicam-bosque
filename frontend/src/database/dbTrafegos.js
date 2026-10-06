import { api } from '../utils/axios';

export const inserirTrafego = (
  token,
  {
    placa,
    nome,
    dataEntrada,
    dataSaida,
    destino,
    morador_destino_id,
    observacao,
    client_id,
    imagem,
    portaria_entrada_id,
    portaria_saida_id,
    logIdentificacaoId,
  }
) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = {
      placa,
      nome,
      dataEntrada,
      dataSaida,
      destino,
      morador_destino_id,
      observacao,
      client_id,
      imagem,
      portaria_entrada_id,
      portaria_saida_id,
      logIdentificacaoId,
    };
    api
      .post(`/trafegos`, data, options)
      .then((response) => {
        console.log(response);
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const listarTrafegos = (token, client_id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/trafegos/client/${client_id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

/**
 * Lista os tráfegos pelo status derivado (travessia, servico, sem_saida, saidas).
 * Filtros: placa, entradaDe, entradaAte, ordem, page, pageSize.
 * Retorna { rows, total, page, pageSize }
 */
export const listarTrafegosPorStatus = (token, client_id, status, filtros = {}) => {
  const params = { status };
  Object.keys(filtros).forEach((chave) => {
    if (filtros[chave] !== null && filtros[chave] !== undefined && filtros[chave] !== '') {
      params[chave] = filtros[chave];
    }
  });
  return new Promise((resolve, reject) => {
    api
      .get(`/trafegos/client/${client_id}`, { headers: { authorization: token }, params })
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

export const obterTrafego = (token, id) => {
  return new Promise((resolve, reject) => {
    api
      .get(`/trafegos/${id}`, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const atualizarTrafego = (token, { id, placa, nome, destino, morador_destino_id, observacao }) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    const data = {
      id,
      placa,
      nome,
      destino,
      morador_destino_id,
      observacao,
    };
    api
      .put(`/trafegos`, data, options)
      .then((response) => {
        console.log(response);
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const removerTrafego = (token, id) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .delete(`/trafegos/${id}`, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export const registrarSaidaManual = (token, id, portariaId) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { authorization: token, 'Content-Type': 'application/json' },
    };
    api
      .post(`/trafegos/saidaManual/${id}/${portariaId}`, {}, options)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
