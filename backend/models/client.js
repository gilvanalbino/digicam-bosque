'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Client extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Client.init(
    {
      name: DataTypes.STRING,
      type: DataTypes.STRING,
      cpfCnpj: DataTypes.STRING,
      cep: DataTypes.STRING,
      address: DataTypes.STRING,
      number: DataTypes.STRING,
      district: DataTypes.STRING,
      city: DataTypes.STRING,
      state: DataTypes.STRING,
      active: DataTypes.BOOLEAN,
      entrada_automatica: DataTypes.BOOLEAN,
      tocar_alarme: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: 'Client',
    }
  );
  return Client;
};
