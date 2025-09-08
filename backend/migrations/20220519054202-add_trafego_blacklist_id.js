'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Trafegos', 'in_blacklist', { type: Sequelize.BOOLEAN, allowNull: true });
    await queryInterface.addColumn('Trafegos', 'blacklist_id', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.sequelize.query(
      'ALTER TABLE Trafegos ADD CONSTRAINT trafegos_blacklist_id_fk FOREIGN KEY (blacklist_id) REFERENCES BlackList (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Trafegos', 'blacklist_id');
    await queryInterface.removeColumn('Trafegos', 'in_blacklist');
  },
};
