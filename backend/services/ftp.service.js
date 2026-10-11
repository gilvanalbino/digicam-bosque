let Client = require('ssh2-sftp-client');

const SFTP_HOST = process.env.SFTP_HOST;
const SFTP_PORT = process.env.SFTP_PORT;
const SFTP_USER = process.env.SFTP_USER;
const SFTP_PASS = process.env.SFTP_PASS;

console.log("SFTP_FOST:", SFTP_HOST);
console.log("SFTP_PORT:", SFTP_PORT);
console.log("SFTP_USER:", SFTP_USER);
console.log("SFTP_PASS:", SFTP_PASS);


const conectar = async (sftp) => {
  await sftp.connect({
    host: SFTP_HOST,
    port: SFTP_PORT,
    username: SFTP_USER,
    password: SFTP_PASS,
  });
};

// fecha a conexão também quando a operação falha, para não deixar conexões abertas no servidor
const desconectar = (sftp) => {
  sftp.end().catch(() => {});
};

const listarArquivos = async (folder, pattern) => {
  const sftp = new Client();
  try {
    await conectar(sftp);
    if (pattern) {
      return await sftp.list("ftp/"+folder, pattern);
    }
    return await sftp.list("ftp/"+folder);
  } catch (error) {
    console.log("Error listarArquivos: ", error);
    throw error;
  } finally {
    desconectar(sftp);
  }
};

const lerArquivo = async (folder, file) => {
  const sftp = new Client();
  try {
    await conectar(sftp);
    return await sftp.get(`ftp/${folder}/${file}`);
  } finally {
    desconectar(sftp);
  }
};

module.exports = {
  listarArquivos,
  lerArquivo,
};
