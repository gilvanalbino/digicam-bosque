'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Trafegos', 'imagem', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Trafegos', 'imagem_thumb', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Trafegos', 'imagem');
    await queryInterface.removeColumn('Trafegos', 'imagem_thumb');
  },
};
