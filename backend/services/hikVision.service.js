const axios = require('axios');

const createDigestClient = require('http-digest-client');

const obterFotoCamera = (url, login, senha) => {
  console.log('obtendo foto camera: ', url, login, senha);
  return new Promise((resolve, reject) => {
    var digest = createDigestClient(login, senha);
    const [host, port] = url.split(':');

    const options = {
      host,
      port: parseInt(port),
      path: '/ISAPI/Streaming/channels/101/picture',
      method: 'GET',
    };

    console.log('options: ', options);

    digest.request(options, function (response) {
      let allData = '';
      let chunks = [];
      response.on('data', function (data) {
        chunks.push(data);
        allData += Buffer.from(data).toString('base64');
      });
      response.on('end', function () {
        const contentType = response.headers['content-type'].split(';')[0];
        const base64String = `data:${contentType};base64,${Buffer.concat(chunks).toString('base64')}`;
        resolve(base64String);
      });
      response.on('error', function (err) {
        console.log('Error: ', err);
      });
    });
  });
};

const obterFotoPlaca = (cameraUrl, picname) => {
  const url = `http://${cameraUrl}/doc/ui/images/plate/${picname}.jpg`;
  console.log('url: ', url);

  const options = { method: 'GET', url, responseType: 'arraybuffer' };

  return new Promise(async (resolve, reject) => {
    await axios
      .request(options)
      .then(function (response) {
        // const contentType = response.headers['content-type'];
        // const base64String = Buffer.from(response.data, 'binary').toString('base64');
        // const ret = `data:${contentType};base64,${base64String}`;
        resolve(response.data);
      })
      .catch(function (error) {
        reject(error);
      });
  });
};

module.exports = {
  obterFotoCamera,
  obterFotoPlaca,
};
