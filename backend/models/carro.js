'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Carro extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  Carro.init({
    placa: DataTypes.STRING,
    modelo: DataTypes.STRING,
    cor: DataTypes.STRING,
    morador_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Carro',
  });
  return Carro;
};