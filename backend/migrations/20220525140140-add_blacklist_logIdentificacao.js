'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('LogIdentificacao', 'blackList_id', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('LogIdentificacao', 'blackList_motivo', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE LogIdentificacao ADD CONSTRAINT logIdentificacao_blackList_id_fk FOREIGN KEY (blackList_id) REFERENCES BlackList (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('LogIdentificacao', 'blackList_id');
    await queryInterface.removeColumn('LogIdentificacao', 'blackList_motivo');
  },
};
