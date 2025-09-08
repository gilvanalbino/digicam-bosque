'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('LogIdentificacao', 'whitelist_id', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('LogIdentificacao', 'whitelist_nome', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.sequelize.query(
      'ALTER TABLE LogIdentificacao ADD CONSTRAINT logIdentificacao_whitelist_id_fk FOREIGN KEY (whitelist_id) REFERENCES WhiteList (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('LogIdentificacao', 'whitelist_id');
    await queryInterface.removeColumn('LogIdentificacao', 'whitelist_nome');
  },
};
