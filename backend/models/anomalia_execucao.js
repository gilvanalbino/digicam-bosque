'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AnomaliaExecucao extends Model {
    static associate(models) {}
  }
  AnomaliaExecucao.init(
    {
      client_id: DataTypes.INTEGER,
      // referencias | incremental | retroativo
      modo: DataTypes.STRING,
      // EM_ANDAMENTO | OK | ERRO
      status: DataTypes.STRING,
      inicio: DataTypes.DATE,
      fim: DataTypes.DATE,
      periodo_inicio: DataTypes.DATE,
      periodo_fim: DataTypes.DATE,
      resumo: DataTypes.JSON,
      erro: DataTypes.TEXT,
      versao_modelo: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'AnomaliaExecucao',
      tableName: 'Anomalia_execucoes',
    }
  );
  return AnomaliaExecucao;
};
