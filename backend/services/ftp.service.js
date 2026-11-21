let Client = require('ssh2-sftp-client');

const SFTP_HOST = process.env.SFTP_HOST;
const SFTP_PORT = process.env.SFTP_PORT;
const SFTP_USER = process.env.SFTP_USER;
const SFTP_PASS = process.env.SFTP_PASS;

console.log("SFTP_FOST:", SFTP_HOST);
console.log("SFTP_PORT:", SFTP_PORT);
console.log("SFTP_USER:", SFTP_USER);


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

/**
 * Numa conexão só, lista a pasta uma vez (filtrando pelo padrão) e lê o arquivo escolhido por cada seletor.
 * Cada operação de FTP leva ~0,6 s (conexão + listagem de uma pasta com milhares de fotos); fazer tudo na mesma
 * conexão tira ~1,5 s de cada leitura de placa. Retorna, para cada seletor, { arquivo, conteudo } (null se faltar).
 */
const lerFotos = async (folder, pattern, seletores) => {
  const sftp = new Client();
  try {
    await conectar(sftp);
    const arquivos = await sftp.list("ftp/" + folder, pattern);
    const resultados = [];
    for (const selecionar of seletores) {
      const arquivo = selecionar(arquivos);
      let conteudo = null;
      if (arquivo) {
        try {
          conteudo = await sftp.get(`ftp/${folder}/${arquivo.name}`);
        } catch (error) {
          console.log('Erro lendo foto', arquivo.name, error.message);
        }
      }
      resultados.push({ arquivo, conteudo });
    }
    return resultados;
  } finally {
    desconectar(sftp);
  }
};

module.exports = {
  listarArquivos,
  lerArquivo,
  lerFotos,
};
