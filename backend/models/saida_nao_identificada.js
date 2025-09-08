'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SaidaNaoIdentificada extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      SaidaNaoIdentificada.belongsTo(models.Camera, { foreignKey: 'camera_id', onDelete: 'CASCADE' });
    }
  }
  SaidaNaoIdentificada.init(
    {
      camera_id: DataTypes.INTEGER,
      placa: DataTypes.STRING,
      data: DataTypes.DATE,
      identificador_placa: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'SaidaNaoIdentificada',
      tableName: 'Saidas_nao_identificadas',
    }
  );
  return SaidaNaoIdentificada;
};
