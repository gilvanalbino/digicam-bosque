'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('LogIdentificacao', 'identificador_placa', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Trafegos', 'identificador_placa', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('LogIdentificacao', 'identificador_placa');
    await queryInterface.removeColumn('Trafegos', 'identificador_placa');
  },
};
