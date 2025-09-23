const { default: AxiosDigestAuth } = require('@mhoc/axios-digest-auth');
var convert = require('xml-js');
const fs = require('fs');

const generateCurlCommand = (url, data, credentials, method = 'GET') => {
  const { username, password } = credentials;

  // Formatar o XML de forma legível
  const formattedData = data.replace(/></g, '>\n<').replace(/^\s+|\s+$/g, '');

  const curlCommand = `curl -X ${method} \\
  --digest -u "${username}:${password}" \\
  -H "Content-Type: application/xml" \\
  -d '${formattedData}' \\
  "${url}"`;

  return curlCommand;
};

const obterPlacas = (camera, searchDate, debug = false) => {
  return new Promise(async (resolve, reject) => {
    try {
      const currentDate = new Date();

      let data = '';
      let url = '';
      if (camera.modelo === 'hikvision-DS-2CD7A26G0/P-IZS') {
        data = `<?xml version="1.0" encoding="UTF-8"?>
            <AfterTime version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
              <picTime>${searchDate.toISOString()}</picTime>
            </AfterTime>`;
        url = `http://${camera.url}/ISAPI/Traffic/channels/101/vehicleDetect/plates`;
      } else if (camera.modelo === 'hikvision-iDS-2CD7A26G0/P-IZHS') {
        data = `<VehicleInfoCond>
              <searchID>0</searchID>
              <TimeSpan>
                  <startTime>${searchDate.toISOString()}</startTime>
                  <stopTime>${currentDate.toISOString()}</stopTime>
              </TimeSpan>
              <maxResults>40</maxResults>
              <plateLicense />
              <downloadResultPosition>0</downloadResultPosition>
            </VehicleInfoCond> `;
        url = `http://${camera.url}/ISAPI/Traffic/vehicleInfoCond`;
      } else {
        console.log('MODELO não ENCONTRADO!!!!');
        return null;
      }
      // console.log('data: ', data);

      const credential = {
        username: camera.login,
        password: camera.senha,
      };
      // console.log('credential: ', credential);
      const digestAuth = new AxiosDigestAuth(credential);

      const options = {
        url,
        headers: {
          // 'Content-Type': 'text/plain',
          'Content-Type': 'application/xml',
        },
        data: data,
        method: 'GET',
      };

      // Debug: Imprimir comando curl equivalente
      if (debug) {
        console.log('\n=== COMANDO CURL EQUIVALENTE ===');
        console.log(generateCurlCommand(url, data, credential, 'GET'));
        console.log('=====================================\n');
      }

      // console.log('options: ', options);
      const response = await digestAuth.request(options);

      const xml = response.data;
      const ret = JSON.parse(convert.xml2json(xml, { compact: true }));
      let placas = [];
      if (camera.modelo === 'hikvision-DS-2CD7A26G0/P-IZS') {
        placas = ret.Plates.Plate.map((p) => {
          // console.log('Placas', ret.Plates.Plate);
          /*
            {
            captureTime: { _text: '20211106T131723-300' },
            plateNumber: { _text: 'LLC3030' },
            picName: { _text: '202111061317235700' },
            country: { _text: 'BRA' },
            laneNo: { _text: '1' },
            direction: { _text: 'forward' },
            matchingResult: { _text: 'otherlist' }
          },
          */
          // console.log(p);
          const sCaptureTime = p.captureTime._text;
          const captureTime =
            sCaptureTime.substring(0, 4) +
            '-' +
            sCaptureTime.substring(4, 6) +
            '-' +
            sCaptureTime.substring(6, 9) +
            sCaptureTime.substring(9, 11) +
            ':' +
            sCaptureTime.substring(11, 13) +
            ':' +
            sCaptureTime.substring(13, 15) +
            '-03:00';

          return {
            picName: p.picName._text,
            captureTime: new Date(captureTime),
            plateNumber: p.plateNumber._text,
            direction: p.direction._text,
            country: p.country._text,
          };
        });
      } else if (camera.modelo === 'hikvision-iDS-2CD7A26G0/P-IZHS') {
        if (!Array.isArray(ret.VehicleInfoResult.VehicleInfoList.VehicleInfo)) {
          p = ret.VehicleInfoResult.VehicleInfoList.VehicleInfo;
          if (typeof p !== 'undefined') {
            placas = [
              {
                picName: '-',
                captureTime: new Date(p.timeSpan._text),
                plateNumber: p.plateNo._text,
                direction: p.direction._text,
                country: p.country._text,
              },
            ];
          }
        } else {
          placas = ret.VehicleInfoResult.VehicleInfoList.VehicleInfo.map((p) => {
            // console.log('placa: ', p);
            return {
              picName: '-',
              captureTime: new Date(p.timeSpan._text),
              plateNumber: p.plateNo._text,
              direction: p.direction._text,
              country: p.country._text,
            };
          });
        }
      }
      resolve(placas);
    } catch (error) {
      console.log(error);
      // if (error.status !== 401) {
      //   console.log('Error: ', error);
      // }
      // reject(error);
      resolve([]);
    }
  });
};

module.exports = {
  obterPlacas,
};
