const axios = require('axios');

// const backend = 'http://digicam-backend-svc';
// const backendUrl = 'https://digicam.interactsystem.com.br';
const backendUrl = process.env.DIGICAM_BACKEND_URL;
const email = 'system@digicam.com.br';
const password = 'digicam@2008';

const login = async () => {
  const url = `${backendUrl}/digicam/login`;
  console.log('url: ', url);
  var config = {
    method: 'post',
    url,
    data: { email, password },
  };
  const ret = await axios(config);
  return ret.data.token;
};

const listarCameras = (token, client_id) => {
  return new Promise((resolve, reject) => {
    const url = `${backendUrl}/digicam/cameras/client/${client_id}`;
    console.log('url: ', url);
    axios
      .get(url, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

const listarPlacasReconhecidas = (token, camera_id) => {
  const url = `${backendUrl}/digicam/logIdentificacao/camera/${camera_id}`;
  return new Promise((resolve, reject) => {
    axios
      .get(url, { headers: { authorization: token } })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

const inserirNovaPlacaIdentificada = (token, placa) => {
  return new Promise((resolve, reject) => {
    const url = `${backendUrl}/digicam/logIdentificacao`;
    const options = {
      method: 'POST',
      url,
      headers: {
        authorization: token,
      },
      data: placa,
    };
    axios
      .request(options)
      .then(function (response) {
        resolve(response.data);
      })
      .catch(function (error) {
        reject(error);
      });
  });
};

const removerIdentificacao = (token, id) => {
  return new Promise((resolve, reject) => {
    const url = `${backendUrl}/digicam/logIdentificacao/${id}`;
    const options = {
      method: 'DELETE',
      url,
      headers: {
        authorization: token,
      },
    };
    axios
      .request(options)
      .then(function (response) {
        resolve(response.data);
      })
      .catch(function (error) {
        reject(error);
      });
  });
};

module.exports = {
  login,
  listarCameras,
  listarPlacasReconhecidas,
  inserirNovaPlacaIdentificada,
  removerIdentificacao,
};
