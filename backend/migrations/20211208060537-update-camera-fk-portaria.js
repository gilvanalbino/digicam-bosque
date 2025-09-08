'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Cameras', 'portaria_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE Cameras ADD CONSTRAINT cameras_portaria_id_fk FOREIGN KEY (portaria_id) REFERENCES Portarias (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
  },

  down: async (queryInterface, Sequelize) => {
    // await queryInterface.sequelize.query('ALTER TABLE Users DROP CONSTRAINT user_client_id_fk');
    await queryInterface.removeColumn('Cameras', 'portaria_id');
  },
};
