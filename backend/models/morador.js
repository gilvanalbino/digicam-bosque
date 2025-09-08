'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Morador extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Morador.init(
    {
      nome: DataTypes.STRING,
      endereco: DataTypes.STRING,
      observacao: DataTypes.STRING,
      client_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: 'Morador',
      tableName: 'Moradores',
    }
  );
  return Morador;
};
