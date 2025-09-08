
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const baseDir = "/digicam-fotos/"

const saveFile = (base64Image, folder, filename, generateThumb) => {
  return new Promise(async (resolve, reject) => {
    const buffer = new Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    try {
      // Verifica se o diretório existe, se não, cria um novo
      const folderPath = baseDir + folder;
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Caminho completo do arquivo
      const filePath = path.join(folderPath, filename + ".jpg");

      // Escreve o arquivo no disco
      fs.writeFile(filePath, buffer, (err) => {
        if (err) {
          console.error('Erro ao salvar o arquivo:', err);
          reject(err);
        } else {
          console.log('Arquivo salvo com sucesso:', filePath);
          resolve(filePath);
        }
      });

      if (generateThumb) {
        sharp(buffer)
          .resize(64, 64)
          .toBuffer()
          .then((resizedImageBuffer) => {
            const filePath = path.join(folderPath, filename + '_thumb.jpg');
            fs.writeFile(filePath, resizedImageBuffer, (err) => {
              if (err) {
                console.error('Erro ao salvar o arquivo:', err);
                reject(err);
              } else {
                console.log('Arquivo salvo com sucesso:', filePath);
                resolve(filePath);
              }
            });
          })
          .catch((error) => {
            reject(error);
          });
      } else {
        resolve();
      }

    } catch (error) {
      console.error(error);
      reject(error);
    }
  });
};

module.exports = {
  saveFile,
};
