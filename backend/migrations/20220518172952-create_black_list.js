'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('BlackList', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      placa: {
        type: Sequelize.STRING,
      },
      marca: {
        type: Sequelize.STRING,
      },
      modelo: {
        type: Sequelize.STRING,
      },
      motivo: {
        type: Sequelize.STRING,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      client_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE WhiteList ADD CONSTRAINT whiteList_client_id_fk FOREIGN KEY (client_id) REFERENCES Clients (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('WhiteList');
  },
};
