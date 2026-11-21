'use strict';
const { Model } = require('sequelize');

/**
 * Uma passagem de veículo por uma câmera, com a leitura da câmera e a do software no mesmo registro
 * (docs/plano_identificacao_placas_software.md, seção 5.1).
 */
module.exports = (sequelize, DataTypes) => {
  class Identificacao extends Model {
    static associate(models) {
      Identificacao.belongsTo(models.Camera, { foreignKey: 'camera_id' });
    }
  }
  Identificacao.init(
    {
      client_id: DataTypes.INTEGER,
      camera_id: DataTypes.INTEGER,
      sentido: DataTypes.STRING,
      origem: DataTypes.STRING,
      placa_camera: DataTypes.STRING,
      placa_software: DataTypes.STRING,
      confianca_software: DataTypes.DECIMAL(4, 3),
      leituras_software: DataTypes.INTEGER,
      classe_veiculo: DataTypes.STRING,
      placa_operador: DataTypes.STRING,
      placa_final: DataTypes.STRING,
      fonte_placa_final: DataTypes.STRING,
      divergente: DataTypes.BOOLEAN,
      software_ligado: DataTypes.BOOLEAN,
      instante_camera: DataTypes.DATE(3),
      instante_software_inicio: DataTypes.DATE(3),
      instante_software: DataTypes.DATE(3),
      direcao_software: DataTypes.STRING,
      identificador_placa: DataTypes.STRING,
      rastro_software: DataTypes.STRING,
      foto_software: DataTypes.STRING,
      foto_software_thumb: DataTypes.STRING,
      foto_software_placa: DataTypes.STRING,
      trafego_id: DataTypes.INTEGER,
      saida_nao_identificada_id: DataTypes.INTEGER,
      situacao: DataTypes.STRING,
      historico: DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'Identificacao',
      tableName: 'Identificacoes',
    }
  );
  return Identificacao;
};
