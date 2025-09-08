'use strict';

// https://www.brcline.com/blog/how-to-write-an-excel-file-in-nodejs

const Excel = require('exceljs');
var dayjs = require('dayjs');
var utc = require('dayjs/plugin/utc');
var timezone = require('dayjs/plugin/timezone');
var advanced = require('dayjs/plugin/advancedFormat');

dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(advanced);

const generateTrafegoExcel = (data, portarias) => {
  const mapPortaria = {};
  for (const portaria of portarias) {
    mapPortaria[portaria.id] = portaria.nome;
  }

  let workbook = new Excel.Workbook();
  let worksheet = workbook.addWorksheet('Trafego');

  worksheet.columns = [
    { header: 'Placa', key: 'placa', width: 12 },
    { header: 'Green List', key: 'greenList', width: 12 },
    { header: 'Data Entrada', key: 'dataEntradaFormatada', width: 20 },
    { header: 'Portaria Entrada', key: 'portariaEntrada', width: 25 },
    { header: 'Nome', key: 'nome', width: 20 },
    { header: 'Destino', key: 'destino', width: 12 },
    { header: 'Observação', key: 'observacao', width: 30 },
    { header: 'Data Saída', key: 'dataSaidaFormatada', width: 20 },
    { header: 'Portaria Saída', key: 'portariaSaida', width: 25 },
  ];
  // worksheet.columns.forEach((column) => {
  //   column.width = column.header.length < 12 ? 12 : column.header.length;
  // });
  worksheet.getRow(1).font = { bold: true };

  data.forEach((d, index) => {
    const row = {
      placa: d.placa,
      nome: d.nome,
      destino: d.destino,
      observacao: d.observacao,
      portariaEntrada: mapPortaria[d.portaria_entrada_id],
      portariaSaida: d.portaria_saida_id ? mapPortaria[d.portaria_saida_id] : '',
      dataEntradaFormatada: dayjs(d.dataEntrada).tz('America/Bahia').format('DD/MM/YYYY HH:mm:ss'),
      dataSaidaFormatada: d.dataSaida ? dayjs(d.dataSaida).tz('America/Bahia').format('DD/MM/YYYY HH:mm:ss') : '',
      greenList: d.in_whitelist ? 'Sim' : '',
    };
    worksheet.addRow(row);
  });

  worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
    worksheet.getCell(`A${rowNumber}`).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'none' },
    };

    const insideColumns = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
    insideColumns.forEach((v) => {
      worksheet.getCell(`${v}${rowNumber}`).border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'none' },
        right: { style: 'none' },
      };
    });

    worksheet.getCell(`I${rowNumber}`).border = {
      top: { style: 'thin' },
      left: { style: 'none' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  return workbook.xlsx.writeBuffer();
};

module.exports = {
  generateTrafegoExcel,
};
