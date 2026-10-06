'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tabela = 'Saidas_nao_identificadas';

    await queryInterface.addColumn(tabela, 'status', {
      type: Sequelize.ENUM('pendente', 'associada', 'arquivada'),
      allowNull: false,
      defaultValue: 'pendente',
    });
    await queryInterface.addColumn(tabela, 'client_id', { type: Sequelize.INTEGER });
    await queryInterface.addColumn(tabela, 'trafego_id', { type: Sequelize.INTEGER });
    await queryInterface.addColumn(tabela, 'resolvido_em', { type: Sequelize.DATE });
    await queryInterface.addColumn(tabela, 'user_resolucao', { type: Sequelize.INTEGER });
    await queryInterface.addColumn(tabela, 'imagem_carro', { type: Sequelize.STRING });
    await queryInterface.addColumn(tabela, 'imagem_carro_thumb', { type: Sequelize.STRING });
    await queryInterface.addColumn(tabela, 'imagem_placa', { type: Sequelize.STRING });
    await queryInterface.addColumn(tabela, 'motivo_arquivamento', { type: Sequelize.STRING });

    await queryInterface.sequelize.query(
      'ALTER TABLE Saidas_nao_identificadas ADD CONSTRAINT saida_nao_ident_client_id_fk FOREIGN KEY (client_id) REFERENCES Clients (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE Saidas_nao_identificadas ADD CONSTRAINT saida_nao_ident_trafego_id_fk FOREIGN KEY (trafego_id) REFERENCES Trafegos (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE SET NULL'
    );

    // backfill do cliente a partir da câmera
    await queryInterface.sequelize.query(
      'UPDATE Saidas_nao_identificadas s INNER JOIN Cameras c ON c.id = s.camera_id SET s.client_id = c.client_id'
    );

    // registros anteriores à implantação não têm imagens: entram como já arquivados (decisão D2)
    await queryInterface.sequelize.query(
      "UPDATE Saidas_nao_identificadas SET status = 'arquivada', resolvido_em = NOW(), motivo_arquivamento = 'Registro anterior à implantação da conciliação manual'"
    );

    await queryInterface.addIndex(tabela, ['client_id', 'status', 'data'], {
      name: 'saida_nao_ident_client_status_data_idx',
    });
    await queryInterface.addIndex('Trafegos', ['client_id', 'dataSaida', 'destino'], {
      name: 'trafegos_client_saida_destino_idx',
    });
  },

  down: async (queryInterface, Sequelize) => {
    const tabela = 'Saidas_nao_identificadas';

    // o MySQL pode passar a usar o índice composto para a FK de Trafegos.client_id e descartar o índice
    // implícito; recria um índice simples antes de remover o composto
    await queryInterface.addIndex('Trafegos', ['client_id'], { name: 'trafegos_client_id_idx' });
    await queryInterface.removeIndex('Trafegos', 'trafegos_client_saida_destino_idx');

    await queryInterface.sequelize.query(
      'ALTER TABLE Saidas_nao_identificadas DROP FOREIGN KEY saida_nao_ident_trafego_id_fk'
    );
    await queryInterface.sequelize.query('ALTER TABLE Saidas_nao_identificadas DROP FOREIGN KEY saida_nao_ident_client_id_fk');
    await queryInterface.removeIndex(tabela, 'saida_nao_ident_client_status_data_idx');

    await queryInterface.removeColumn(tabela, 'motivo_arquivamento');
    await queryInterface.removeColumn(tabela, 'imagem_placa');
    await queryInterface.removeColumn(tabela, 'imagem_carro_thumb');
    await queryInterface.removeColumn(tabela, 'imagem_carro');
    await queryInterface.removeColumn(tabela, 'user_resolucao');
    await queryInterface.removeColumn(tabela, 'resolvido_em');
    await queryInterface.removeColumn(tabela, 'trafego_id');
    await queryInterface.removeColumn(tabela, 'client_id');
    await queryInterface.removeColumn(tabela, 'status');
  },
};
