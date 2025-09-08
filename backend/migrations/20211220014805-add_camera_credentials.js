'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Cameras', 'login', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Cameras', 'senha', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Cameras', 'login');
    await queryInterface.removeColumn('Cameras', 'senha');
  },
};
