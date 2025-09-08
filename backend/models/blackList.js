'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class BlackList extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      BlackList.belongsTo(models.Client, { foreignKey: 'client_id', onDelete: 'CASCADE' });
    }
  }
  BlackList.init(
    {
      placa: DataTypes.STRING,
      marca: DataTypes.STRING,
      modelo: DataTypes.STRING,
      motivo: DataTypes.STRING,
      user_id: DataTypes.INTEGER,
      client_id: DataTypes.INTEGER,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'BlackList',
      tableName: 'BlackList',
    }
  );
  return BlackList;
};
