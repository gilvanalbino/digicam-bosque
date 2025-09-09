const { sequelize } = require('../models');

/**
 * Service para operações diretas no banco usando Sequelize
 * Substitui o databaseService.js que usava mysql2 direto
 */

const obterLogIdentificacaoPlaca = async (placaId) => {
  try {
    const [results] = await sequelize.query(
      `SELECT
        id, placa, identificador_placa
      FROM
        LogIdentificacao
      WHERE
        identificador_placa = :placaId`,
      {
        replacements: { placaId },
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    return results || null;
  } catch (error) {
    console.error('Error obterLogIdentificacaoPlaca:', error);
    throw error;
  }
};

const obterTrafegoEntradaPlaca = async (placaId) => {
  try {
    const [results] = await sequelize.query(
      `SELECT
        id, placa, dataEntrada, placa_saida, dataSaida, identificador_placa, identificador_placa_saida
      FROM
        Trafegos
      WHERE
        identificador_placa = :placaId`,
      {
        replacements: { placaId },
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    return results || null;
  } catch (error) {
    console.error('Error obterTrafegoEntradaPlaca:', error);
    throw error;
  }
};

const obterTrafegoSaidaPlaca = async (placaId) => {
  try {
    const [results] = await sequelize.query(
      `SELECT
        id, placa, dataEntrada, placa_saida, dataSaida, identificador_placa, identificador_placa_saida
      FROM
        Trafegos
      WHERE
        identificador_placa_saida = :placaId`,
      {
        replacements: { placaId },
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    return results || null;
  } catch (error) {
    console.error('Error obterTrafegoSaidaPlaca:', error);
    throw error;
  }
};

module.exports = {
  obterLogIdentificacaoPlaca,
  obterTrafegoEntradaPlaca,
  obterTrafegoSaidaPlaca,
};