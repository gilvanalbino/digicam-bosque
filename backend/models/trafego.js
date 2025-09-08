'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Trafego extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Trafego.init(
    {
      placa: DataTypes.STRING,

      placa_saida: DataTypes.STRING,

      dataEntrada: DataTypes.DATE,
      dataSaida: DataTypes.DATE,

      destino: DataTypes.STRING,
      morador_destino_id: DataTypes.INTEGER,
      observacao: DataTypes.STRING,

      imagem: DataTypes.STRING,
      imagem_thumb: DataTypes.STRING,
      imagem_placa: DataTypes.STRING,

      client_id: DataTypes.INTEGER,
      nome: DataTypes.STRING,

      portaria_entrada_id: DataTypes.INTEGER,
      portaria_saida_id: DataTypes.INTEGER,

      user_reg_entrada: DataTypes.INTEGER,
      user_reg_saida: DataTypes.INTEGER,

      imagem_saida: DataTypes.STRING,
      imagem_saida_thumb: DataTypes.STRING,
      imagem_saida_placa: DataTypes.STRING,

      saida_automatica: DataTypes.BOOLEAN,

      whitelist_id: DataTypes.INTEGER,

      // usado para whitelist apagadas não retornar o veículo como pendente de saída
      in_whitelist: DataTypes.BOOLEAN,

      blacklist_id: DataTypes.INTEGER,
      // usado para blacklist apagadas
      in_blacklist: DataTypes.BOOLEAN,

      identificador_placa: DataTypes.STRING,
      identificador_placa_saida: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'Trafego',
    }
  );
  return Trafego;
};
