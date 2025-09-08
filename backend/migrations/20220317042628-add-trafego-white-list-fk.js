'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Trafegos', 'in_whitelist', { type: Sequelize.BOOLEAN, allowNull: true });
    await queryInterface.addColumn('Trafegos', 'whitelist_id', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.sequelize.query(
      'ALTER TABLE Trafegos ADD CONSTRAINT trafegos_whitelist_id_fk FOREIGN KEY (whitelist_id) REFERENCES WhiteList (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Trafegos', 'whitelist_id');
    await queryInterface.removeColumn('Trafegos', 'in_whitelist');
  },
};
