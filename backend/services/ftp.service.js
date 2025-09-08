let Client = require('ssh2-sftp-client');

const SFTP_HOST = process.env.SFTP_HOST;
const SFTP_PORT = process.env.SFTP_PORT;
const SFTP_USER = process.env.SFTP_USER;
const SFTP_PASS = process.env.SFTP_PASS;

console.log("SFTP_FOST:", SFTP_HOST);
console.log("SFTP_PORT:", SFTP_PORT);
console.log("SFTP_USER:", SFTP_USER);
console.log("SFTP_PASS:", SFTP_PASS);


const listarArquivos = (folder, pattern) => {
  return new Promise(async (resolve, reject) => {
    try {
      let sftp = new Client();
      await sftp.connect({
        host: SFTP_HOST,
        port: SFTP_PORT,
        username: SFTP_USER,
        password: SFTP_PASS,
      });
      let files = [];
      if (pattern) {
        files = await sftp.list("ftp/"+folder, pattern);
      } else {
        files = await sftp.list("ftp/"+folder);
      }
      sftp.end();

      resolve(files);
    } catch (error) {
      console.log("Error listarArquivos: ", error); 
      reject(error);
    }
  });
};

const lerArquivo = (folder, file) => {
  return new Promise(async (resolve, reject) => {
    try {
      let sftp = new Client();
      await sftp.connect({
        host: SFTP_HOST,
        port: SFTP_PORT,
        username: SFTP_USER,
        password: SFTP_PASS,
      });
      const buffer = await sftp.get(`ftp/${folder}/${file}`);
      sftp.end();
      // const contentType = 'image/jpeg'; // response.headers['content-type'].split(';')[0];
      // const base64String = `data:${contentType};base64,${buffer.toString('base64')}`;
      // resolve(base64String);
      resolve(buffer);
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  listarArquivos,
  lerArquivo,
};
