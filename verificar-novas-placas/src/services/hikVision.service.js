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

const testarLicensePlateAuditData = async (camera, searchDate, debug = false) => {
  try {
    const currentDate = new Date();
    const credential = {
      username: camera.login,
      password: camera.senha,
    };

    // Formatar datas para o formato necessário (sem milissegundos)
    const startTime = searchDate.toISOString().split('.')[0] + 'Z';
    const stopTime = currentDate.toISOString().split('.')[0] + 'Z';

    const url = `http://${camera.url}/ISAPI/Traffic/channels/1/licensePlateAuditData/record?format=json&searchResultPosition=0&maxResults=40&startTime=${startTime}&stopTime=${stopTime}`;

    const digestAuth = new AxiosDigestAuth(credential);

    if (debug) {
      console.log('\n=== TESTANDO ENDPOINT ALTERNATIVO ===');
      console.log('URL:', url);
      console.log(`curl -X GET --digest -u "${credential.username}:${credential.password}" "${url}"`);
      console.log('=====================================\n');
    }

    const response = await digestAuth.request({
      url,
      method: 'GET',
    });

    if (debug) {
      console.log('\n=== RESPOSTA LICENSEPLATE AUDIT DATA ===');
      console.log('Status:', response.status);
      console.log('Data:', JSON.stringify(response.data, null, 2));
      console.log('=======================================\n');
    }

    return response.data;
  } catch (error) {
    if (debug) {
      console.log('\n=== ERRO NO ENDPOINT ALTERNATIVO ===');
      console.log('Erro:', error.message);
      console.log('Status:', error.response?.status);
      console.log('==================================\n');
    }
    return null;
  }
};

const obterPlacas = (camera, searchDate, debug = false) => {
  return new Promise(async (resolve, reject) => {
    try {
      const currentDate = new Date();

      let data = '';
      let url = '';
      let method = 'GET'; // Método padrão
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
        method = 'POST'; // Modelo iDS requer POST
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
        method: method, // Usar o método determinado baseado no modelo
      };

      // Debug: Imprimir comando curl equivalente
      if (debug) {
        console.log('\n=== COMANDO CURL EQUIVALENTE ===');
        console.log(generateCurlCommand(url, data, credential, method));
        console.log('=====================================\n');
      }

      // console.log('options: ', options);
      const response = await digestAuth.request(options);

      const xml = response.data;

      // Debug: Logs detalhados para modelo iDS
      if (debug && camera.modelo === 'hikvision-iDS-2CD7A26G0/P-IZHS') {
        console.log('\n=== DEBUG RESPOSTA CAMERA iDS ===');
        console.log('Status da resposta:', response.status);
        console.log('Headers da resposta:', response.headers);
        console.log('XML recebido:', xml);
        console.log('================================\n');
      }

      const ret = JSON.parse(convert.xml2json(xml, { compact: true }));

      // Debug: Estrutura JSON convertida
      if (debug && camera.modelo === 'hikvision-iDS-2CD7A26G0/P-IZHS') {
        console.log('\n=== DEBUG JSON CONVERTIDO ===');
        console.log(JSON.stringify(ret, null, 2));
        console.log('=============================\n');
      }
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
        // Tentar processar resposta do vehicleInfoCond
        if (ret.VehicleInfoResult && ret.VehicleInfoResult.VehicleInfoList && ret.VehicleInfoResult.VehicleInfoList.VehicleInfo) {
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

        // Se não obteve resultados, tentar endpoint alternativo
        if (placas.length === 0) {
          if (debug) {
            console.log('\n=== TENTANDO ENDPOINT ALTERNATIVO ===');
            console.log('vehicleInfoCond não retornou resultados, testando licensePlateAuditData...');
            console.log('===================================\n');
          }

          const alternativeData = await testarLicensePlateAuditData(camera, searchDate, debug);
          if (alternativeData && alternativeData.LicensePlateAuditDataList && alternativeData.LicensePlateAuditDataList.LicensePlateAuditData) {
            const auditDataList = Array.isArray(alternativeData.LicensePlateAuditDataList.LicensePlateAuditData)
              ? alternativeData.LicensePlateAuditDataList.LicensePlateAuditData
              : [alternativeData.LicensePlateAuditDataList.LicensePlateAuditData];

            placas = auditDataList.map((item) => ({
              picName: item.picName || '-',
              captureTime: new Date(item.dateTime),
              plateNumber: item.licensePlateNumber,
              direction: item.direction || 'unknown',
              country: item.country || 'BRA',
            }));

            if (debug) {
              console.log('\n=== RESULTADO ENDPOINT ALTERNATIVO ===');
              console.log(`Encontradas ${placas.length} placas via licensePlateAuditData`);
              console.log('====================================\n');
            }
          }
        }
      }
      if (debug) {
        console.log('\n=== RESULTADO FINAL ===');
        console.log(`Total de placas encontradas: ${placas.length}`);
        console.log('Placas:', placas.map(p => p.plateNumber).join(', '));
        console.log('====================\n');
      }

      resolve(placas);
    } catch (error) {
      if (debug) {
        console.log('\n=== ERRO NA REQUISIÇÃO ===');
        console.log('Modelo da câmera:', camera.modelo);
        console.log('URL da câmera:', camera.url);
        console.log('Erro:', error.message);
        console.log('Status HTTP:', error.response?.status);
        console.log('Dados da resposta:', error.response?.data);
        console.log('========================\n');
      }

      console.log(`Erro ao obter placas da câmera ${camera.url}:`, error.message);

      // Para câmeras iDS, tentar endpoint alternativo mesmo em caso de erro
      if (camera.modelo === 'hikvision-iDS-2CD7A26G0/P-IZHS') {
        try {
          if (debug) {
            console.log('\n=== TENTANDO RECUPERAÇÃO COM ENDPOINT ALTERNATIVO ===');
          }

          const alternativeData = await testarLicensePlateAuditData(camera, searchDate, debug);
          if (alternativeData) {
            if (debug) {
              console.log('Endpoint alternativo funcionou como fallback!');
            }
            // Processar dados do endpoint alternativo
            // (implementação similar ao bloco anterior)
          }
        } catch (fallbackError) {
          if (debug) {
            console.log('Endpoint alternativo também falhou:', fallbackError.message);
          }
        }
      }

      resolve([]);
    }
  });
};

const testarConectividade = async (camera, debug = false) => {
  const endpoints = [
    '/ISAPI/System/deviceInfo',
    '/ISAPI/Traffic/vehicleInfoCond',
    '/ISAPI/Traffic/channels/1/licensePlateAuditData/record',
    '/ISAPI/Traffic/channels/101/vehicleDetect/plates'
  ];

  const credential = {
    username: camera.login,
    password: camera.senha,
  };

  const digestAuth = new AxiosDigestAuth(credential);
  const resultados = {};

  for (const endpoint of endpoints) {
    try {
      const url = `http://${camera.url}${endpoint}`;

      if (debug) {
        console.log(`\n=== TESTANDO ${endpoint} ===`);
        console.log('URL:', url);
      }

      const response = await digestAuth.request({
        url,
        method: 'GET',
        timeout: 5000, // 5 segundos de timeout
      });

      resultados[endpoint] = {
        status: 'sucesso',
        httpStatus: response.status,
        temDados: response.data ? true : false
      };

      if (debug) {
        console.log('✅ Sucesso - Status:', response.status);
      }

    } catch (error) {
      resultados[endpoint] = {
        status: 'erro',
        httpStatus: error.response?.status || 'timeout',
        erro: error.message
      };

      if (debug) {
        console.log('❌ Erro:', error.message);
      }
    }
  }

  if (debug) {
    console.log('\n=== RESUMO DOS TESTES ===');
    Object.entries(resultados).forEach(([endpoint, resultado]) => {
      const status = resultado.status === 'sucesso' ? '✅' : '❌';
      console.log(`${status} ${endpoint}: ${resultado.httpStatus}`);
    });
    console.log('========================\n');
  }

  return resultados;
};

module.exports = {
  obterPlacas,
  testarConectividade,
};
