// https://stackoverflow.com/questions/13979558/saving-an-image-stored-on-s3-using-node-js

const Jimp = require('jimp');
const sharp = require('sharp');

var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config/s3_config.json');

const saveFile = (base64Image, folder, filename, generateThumb) => {
  return new Promise(async (resolve, reject) => {
    try {
      const bucket = new AWS.S3();
      const buffer = new Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const params = {
        Bucket: 'digicam-new',
        Key: folder + '/' + filename + '.jpg',
        // ACL: 'public-read',
        ContentEncoding: 'base64,',
        Body: buffer,
        ContentType: 'image/jpeg',
      };

      bucket.upload(params, function (err, data) {
        if (err) {
          console.log('There was an error uploading your file: ', err);
          reject(err);
        } else {
          console.log('Successfully uploaded file.', data);
        }
      });

      if (generateThumb) {
        sharp(buffer)
          .resize(64, 64)
          .toBuffer()
          .then((resizedImageBuffer) => {
            const paramsThumb = {
              Bucket: 'digicam-new',
              Key: folder + '/' + filename + '_thumb.jpg',
              // ACL: 'public-read',
              ContentEncoding: 'base64,',
              Body: resizedImageBuffer,
              ContentType: 'image/jpeg',
            };
            bucket.upload(paramsThumb, function (err, data) {
              if (err) {
                console.log('There was an error uploading your thumb file: ', err);
                reject(err);
              } else {
                console.log('Successfully uploaded thumb file.');
                resolve();
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
