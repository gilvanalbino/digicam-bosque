'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Camera extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Camera.belongsTo(models.Client, { foreignKey: 'client_id', onDelete: 'CASCADE' });
    }
  }
  Camera.init(
    {
      nome: DataTypes.STRING,
      url: DataTypes.STRING,
      modelo: DataTypes.STRING,
      sentido: DataTypes.STRING,
      posicionamento: DataTypes.STRING,
      client_id: DataTypes.INTEGER,
      portaria_id: DataTypes.INTEGER,
      login: DataTypes.STRING,
      senha: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'Camera',
    }
  );
  return Camera;
};
