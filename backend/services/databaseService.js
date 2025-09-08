// get the client
const mysql = require('mysql2/promise');
const bluebird = require('bluebird');

const DATABASE_USER = process.env.DATABASE_USER;
const DATABASE_PASS = process.env.DATABASE_PASS;
const DATABASE_NAME = process.env.DATABASE_NAME;
const DATABASE_HOST = process.env.DATABASE_HOST;

let connection = null;

const createConnectionIfNeed = async () => {
  if (!connection) {
    console.log('connectando ao banco de dados ... ');
    // create the connection to database
    connection = await mysql.createConnection({
      host: DATABASE_HOST,
      user: DATABASE_USER,
      password: DATABASE_PASS,
      database: DATABASE_NAME,
      Promise: bluebird,
    });
    console.log('... conectado!');
  }
};

const obterLogIdentificacaoPlaca = async (placaId) => {
  await createConnectionIfNeed();
  return new Promise(async (resolve, reject) => {
    try {
      const [rows, fields] = await connection.query(
        `SELECT
          id, placa, identificador_placa
        FROM
          LogIdentificacao
        WHERE
          identificador_placa = ?`,
        [placaId]
      );
      if (rows.length > 0) {
        resolve(rows[0]);
      } else {
        resolve(null);
      }
    } catch (error) {
      console.log('Error:', error);
      reject(error);
    }
  });
};

const obterTrafegoEntradaPlaca = async (placaId) => {
  await createConnectionIfNeed();
  return new Promise(async (resolve, reject) => {
    try {
      const [rows, fields] = await connection.query(
        `SELECT
          id, placa, dataEntrada, placa_saida, dataSaida, identificador_placa, identificador_placa_saida
        FROM
          Trafegos
        WHERE
          identificador_placa = ?`,
        [placaId]
      );
      if (rows.length > 0) {
        resolve(rows[0]);
      } else {
        resolve(null);
      }
    } catch (error) {
      console.log('Error:', error);
      reject(error);
    }
  });
};

const obterTrafegoSaidaPlaca = async (placaId) => {
  await createConnectionIfNeed();
  return new Promise(async (resolve, reject) => {
    try {
      const [rows, fields] = await connection.query(
        `SELECT
          id, placa, dataEntrada, placa_saida, dataSaida, identificador_placa, identificador_placa_saida
        FROM
          Trafegos
        WHERE
          identificador_placa_saida = ?`,
        [placaId]
      );
      if (rows.length > 0) {
        resolve(rows[0]);
      } else {
        resolve(null);
      }
    } catch (error) {
      console.log('Error:', error);
      reject(error);
    }
  });
};

module.exports = {
  obterLogIdentificacaoPlaca,
  obterTrafegoEntradaPlaca,
  obterTrafegoSaidaPlaca,
};
