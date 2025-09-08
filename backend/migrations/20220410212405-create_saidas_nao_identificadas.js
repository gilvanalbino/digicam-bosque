'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Saidas_nao_identificadas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      identificador_placa: {
        type: Sequelize.STRING,
      },
      placa: {
        type: Sequelize.STRING,
      },
      data: {
        type: Sequelize.DATE,
      },
      camera_id: {
        type: Sequelize.INTEGER,
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
      'ALTER TABLE Saidas_nao_identificadas ADD CONSTRAINT saida_nao_ident_camera_id_fk FOREIGN KEY (camera_id) REFERENCES Cameras (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Saidas_nao_identificadas');
  },
};
