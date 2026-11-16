'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class LogIdentificacao extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      LogIdentificacao.belongsTo(models.Camera, { foreignKey: 'camera_id', onDelete: 'CASCADE' });
    }
  }
  LogIdentificacao.init(
    {
      camera_id: DataTypes.INTEGER,
      placa: DataTypes.STRING,
      picname: DataTypes.STRING,
      sentido: DataTypes.STRING,
      data: DataTypes.DATE,
      imagem_carro: {
        type: DataTypes.BLOB('long'),
        get() {
          // foto gravada vazia (arquivo de 0 bytes no FTP) conta como sem foto
          const imagem = this.getDataValue('imagem_carro');
          if (imagem && imagem.length > 0) {
            return 'data:image/jpeg;base64,' + imagem.toString('base64');
          } else {
            return null;
          }
        },
      },
      imagem_placa: {
        type: DataTypes.BLOB('long'),
        get() {
          // foto gravada vazia (arquivo de 0 bytes no FTP) conta como sem foto
          const imagem = this.getDataValue('imagem_placa');
          if (imagem && imagem.length > 0) {
            return 'data:image/jpeg;base64,' + imagem.toString('base64');
          } else {
            return null;
          }
        },
      },
      imagem_pendente: DataTypes.BOOLEAN,
      whitelist_id: DataTypes.INTEGER,
      whitelist_nome: DataTypes.STRING,
      identificador_placa: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'LogIdentificacao',
      tableName: 'LogIdentificacao',
    }
  );
  return LogIdentificacao;
};
