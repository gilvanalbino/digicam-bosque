'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('LogIdentificacao', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      placa: {
        type: Sequelize.STRING,
      },
      sentido: {
        type: Sequelize.STRING,
      },
      data: {
        type: Sequelize.DATE,
      },
      imagem_carro: {
        type: Sequelize.BLOB('long'),
      },
      imagem_placa: {
        type: Sequelize.BLOB('long'),
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
      'ALTER TABLE LogIdentificacao ADD CONSTRAINT log_ident_camera_id_fk FOREIGN KEY (camera_id) REFERENCES Cameras (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('LogIdentificacao');
  },
};
