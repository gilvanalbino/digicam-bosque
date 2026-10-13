'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AnomaliaReferencia extends Model {
    static associate(models) {}
  }
  AnomaliaReferencia.init(
    {
      client_id: DataTypes.INTEGER,
      // nulo nas referências de perfil
      chave_veiculo: DataTypes.STRING,
      perfil: DataTypes.STRING,
      janela_inicio: DataTypes.DATE,
      janela_fim: DataTypes.DATE,
      qtd_viagens: DataTypes.INTEGER,
      qtd_passagens: DataTypes.INTEGER,
      duracao_mediana: DataTypes.FLOAT,
      duracao_mad: DataTypes.FLOAT,
      duracao_p95: DataTypes.FLOAT,
      duracao_p99: DataTypes.FLOAT,
      dados: DataTypes.JSON,
      versao_modelo: DataTypes.STRING,
      calculado_em: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'AnomaliaReferencia',
      tableName: 'Anomalia_referencias',
    }
  );
  return AnomaliaReferencia;
};
