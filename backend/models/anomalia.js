'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Anomalia extends Model {
    static associate(models) {
      Anomalia.hasMany(models.AnomaliaRevisao, { foreignKey: 'anomalia_id', as: 'revisoes' });
    }
  }
  Anomalia.init(
    {
      client_id: DataTypes.INTEGER,
      trafego_id: DataTypes.INTEGER,
      chave_veiculo: DataTypes.STRING,
      chave_deduplicacao: DataTypes.STRING,
      tipo: DataTypes.STRING,
      ocorrido_em: DataTypes.DATE,
      score: DataTypes.FLOAT,
      score_duracao: DataTypes.FLOAT,
      score_frequencia: DataTypes.FLOAT,
      score_horario: DataTypes.FLOAT,
      score_rota: DataTypes.FLOAT,
      score_persistencia: DataTypes.FLOAT,
      qualidade_dados: DataTypes.JSON,
      motivos: DataTypes.JSON,
      evidencias: DataTypes.JSON,
      versao_modelo: DataTypes.STRING,
      // ABERTA | REVISADA | DESCARTADA | CONFIRMADA
      status: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'Anomalia',
      tableName: 'Anomalias',
    }
  );
  return Anomalia;
};
