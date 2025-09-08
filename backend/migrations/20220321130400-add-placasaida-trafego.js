'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Trafegos', 'placa_saida', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Trafegos', 'placa_saida');
  },
};
