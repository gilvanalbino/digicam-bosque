'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Trafegos', 'saida_automatica', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await queryInterface.addColumn('Trafegos', 'user_reg_entrada', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Trafegos', 'user_reg_saida', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Trafegos', 'saida_automatica');
    await queryInterface.removeColumn('Trafegos', 'user_reg_entrada');
    await queryInterface.removeColumn('Trafegos', 'user_reg_saida');
  },
};
