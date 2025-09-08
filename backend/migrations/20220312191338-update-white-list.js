'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('WhiteList', 'marca', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('WhiteList', 'modelo', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('WhiteList', 'nome', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('WhiteList', 'endereco', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('WhiteList', 'numero', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('WhiteList', 'complemento', { type: Sequelize.STRING, allowNull: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('WhiteList', 'marca');
    await queryInterface.removeColumn('WhiteList', 'modelo');
    await queryInterface.removeColumn('WhiteList', 'nome');
    await queryInterface.removeColumn('WhiteList', 'endereco');
    await queryInterface.removeColumn('WhiteList', 'numero');
    await queryInterface.removeColumn('WhiteList', 'complemento');
  },
};
