'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // marca as saídas associadas pelo sistema a uma entrada de placa próxima (podem ser desfeitas pelo operador)
    await queryInterface.addColumn('Saidas_nao_identificadas', 'associacao_automatica', { type: Sequelize.BOOLEAN });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Saidas_nao_identificadas', 'associacao_automatica');
  },
};
