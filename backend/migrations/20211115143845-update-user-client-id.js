'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'client_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE Users ADD CONSTRAINT user_client_id_fk FOREIGN KEY (client_id) REFERENCES Clients (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
  },

  down: async (queryInterface, Sequelize) => {
    // await queryInterface.sequelize.query('ALTER TABLE Users DROP CONSTRAINT user_client_id_fk');
    await queryInterface.removeColumn('Users', 'client_id');
  },
};
