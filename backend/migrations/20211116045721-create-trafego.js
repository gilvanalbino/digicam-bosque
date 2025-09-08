'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Trafegos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      placa: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      dataEntrada: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      dataSaida: {
        type: Sequelize.DATE,
      },
      destino: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      morador_destino_id: {
        type: Sequelize.INTEGER,
      },
      client_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE Trafegos ADD CONSTRAINT trafego_client_id_fk FOREIGN KEY (client_id) REFERENCES Clients (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Trafegos');
  },
};
