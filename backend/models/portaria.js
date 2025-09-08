'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Portaria extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Portaria.init(
    {
      nome: DataTypes.STRING,
      client_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: 'Portaria',
      tableName: 'Portarias',
    }
  );
  return Portaria;
};
