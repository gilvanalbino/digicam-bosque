'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AnomaliaEstado extends Model {
    static associate(models) {}
  }
  AnomaliaEstado.init(
    {
      client_id: DataTypes.INTEGER,
      chave_veiculo: DataTypes.STRING,
      ewma_duracao: DataTypes.FLOAT,
      ewma_frequencia: DataTypes.FLOAT,
      ultima_passagem_em: DataTypes.DATE,
      dados: DataTypes.JSON,
      versao_modelo: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'AnomaliaEstado',
      tableName: 'Anomalia_estados',
    }
  );
  return AnomaliaEstado;
};
