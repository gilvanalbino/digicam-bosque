'use strict';

const { Model } = require('sequelize');

const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  User.init(
    {
      name: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      active: DataTypes.BOOLEAN,
      admin: DataTypes.BOOLEAN,
      admin_client: DataTypes.BOOLEAN,
      client_id: DataTypes.BIGINT,
    },
    {
      sequelize,
      modelName: 'User',
    }
  );

  User.generateHash = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
  };

  User.validPassword = function (password, criptedPassword) {
    return bcrypt.compareSync(password, criptedPassword);
  };

  User.beforeCreate(async (user, options) => {
    const hashedPassword = await User.generateHash(user.password);
    user.password = hashedPassword;
  });

  return User;
};
