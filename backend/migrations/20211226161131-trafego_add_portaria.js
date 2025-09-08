'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Trafegos', 'portaria_entrada_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE Trafegos ADD CONSTRAINT trafegos_portaria_entrada_id_fk FOREIGN KEY (portaria_entrada_id) REFERENCES Portarias (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
    await queryInterface.addColumn('Trafegos', 'portaria_saida_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE Trafegos ADD CONSTRAINT trafegos_portaria_saida_id_fk FOREIGN KEY (portaria_saida_id) REFERENCES Portarias (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Trafegos', 'portaria_entrada_id');
    await queryInterface.removeColumn('Trafegos', 'portaria_saida_id');
  },
};
