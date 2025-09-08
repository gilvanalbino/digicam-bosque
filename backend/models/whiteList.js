'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class WhiteList extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      WhiteList.belongsTo(models.Client, { foreignKey: 'client_id', onDelete: 'CASCADE' });
    }
  }
  WhiteList.init(
    {
      placa: DataTypes.STRING,
      marca: DataTypes.STRING,
      modelo: DataTypes.STRING,
      nome: DataTypes.STRING,
      endereco: DataTypes.STRING,
      numero: DataTypes.STRING,
      complemento: DataTypes.STRING,
      user_id: DataTypes.INTEGER,
      client_id: DataTypes.INTEGER,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'WhiteList',
      tableName: 'WhiteList',
    }
  );
  return WhiteList;
};
