'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AnomaliaRevisao extends Model {
    static associate(models) {
      AnomaliaRevisao.belongsTo(models.Anomalia, { foreignKey: 'anomalia_id' });
      AnomaliaRevisao.belongsTo(models.User, { foreignKey: 'user_id' });
    }
  }
  AnomaliaRevisao.init(
    {
      client_id: DataTypes.INTEGER,
      anomalia_id: DataTypes.INTEGER,
      user_id: DataTypes.INTEGER,
      // REVISADA | DESCARTADA | CONFIRMADA
      resultado: DataTypes.STRING,
      motivo: DataTypes.STRING,
      revisado_em: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'AnomaliaRevisao',
      tableName: 'Anomalia_revisoes',
    }
  );
  return AnomaliaRevisao;
};
