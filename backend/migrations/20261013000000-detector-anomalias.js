'use strict';
// Tabelas do detector estatístico de anomalias (docs/plano_anomalia.md). Nenhuma tabela operacional é alterada.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const datas = {
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    };
    const id = { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER };
    const cliente = {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'Clients', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    };

    // referências estatísticas por placa (chave_veiculo preenchida) e por perfil (chave_veiculo nula)
    await queryInterface.createTable('Anomalia_referencias', {
      id,
      client_id: cliente,
      chave_veiculo: { type: Sequelize.STRING(20) },
      perfil: { type: Sequelize.STRING(30), allowNull: false },
      janela_inicio: { type: Sequelize.DATE, allowNull: false },
      janela_fim: { type: Sequelize.DATE, allowNull: false },
      qtd_viagens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      qtd_passagens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      duracao_mediana: { type: Sequelize.FLOAT },
      duracao_mad: { type: Sequelize.FLOAT },
      duracao_p95: { type: Sequelize.FLOAT },
      duracao_p99: { type: Sequelize.FLOAT },
      dados: { type: Sequelize.JSON },
      versao_modelo: { type: Sequelize.STRING(20), allowNull: false },
      calculado_em: { type: Sequelize.DATE, allowNull: false },
      ...datas,
    });
    await queryInterface.addIndex('Anomalia_referencias', ['client_id', 'chave_veiculo', 'calculado_em'], {
      name: 'anomalia_ref_client_chave_calc_idx',
    });
    await queryInterface.addIndex('Anomalia_referencias', ['client_id', 'janela_fim'], {
      name: 'anomalia_ref_client_janela_idx',
    });

    // estado corrente de mudança persistente (EWMA) por placa
    await queryInterface.createTable('Anomalia_estados', {
      id,
      client_id: cliente,
      chave_veiculo: { type: Sequelize.STRING(20), allowNull: false },
      ewma_duracao: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      ewma_frequencia: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      ultima_passagem_em: { type: Sequelize.DATE },
      dados: { type: Sequelize.JSON },
      versao_modelo: { type: Sequelize.STRING(20), allowNull: false },
      ...datas,
    });
    await queryInterface.addIndex('Anomalia_estados', ['client_id', 'chave_veiculo'], {
      name: 'anomalia_estado_client_chave_idxu',
      unique: true,
    });

    // alertas: no máximo um por placa, dia e versão do modelo (chave_deduplicacao)
    await queryInterface.createTable('Anomalias', {
      id,
      client_id: cliente,
      trafego_id: {
        type: Sequelize.INTEGER,
        references: { model: 'Trafegos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      chave_veiculo: { type: Sequelize.STRING(20), allowNull: false },
      chave_deduplicacao: { type: Sequelize.STRING(80), allowNull: false },
      tipo: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'dia' },
      ocorrido_em: { type: Sequelize.DATE, allowNull: false },
      score: { type: Sequelize.FLOAT, allowNull: false },
      score_duracao: { type: Sequelize.FLOAT },
      score_frequencia: { type: Sequelize.FLOAT },
      score_horario: { type: Sequelize.FLOAT },
      score_rota: { type: Sequelize.FLOAT },
      score_persistencia: { type: Sequelize.FLOAT },
      qualidade_dados: { type: Sequelize.JSON },
      motivos: { type: Sequelize.JSON },
      evidencias: { type: Sequelize.JSON },
      versao_modelo: { type: Sequelize.STRING(20), allowNull: false },
      // ABERTA | REVISADA | DESCARTADA | CONFIRMADA
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ABERTA' },
      ...datas,
    });
    await queryInterface.addIndex('Anomalias', ['chave_deduplicacao'], { name: 'anomalias_deduplicacao_idxu', unique: true });
    await queryInterface.addIndex('Anomalias', ['client_id', 'status', 'score', 'createdAt'], {
      name: 'anomalias_client_status_score_idx',
    });
    await queryInterface.addIndex('Anomalias', ['client_id', 'ocorrido_em'], { name: 'anomalias_client_ocorrido_idx' });
    await queryInterface.addIndex('Anomalias', ['client_id', 'chave_veiculo', 'ocorrido_em'], {
      name: 'anomalias_client_chave_idx',
    });

    // decisões dos revisores
    await queryInterface.createTable('Anomalia_revisoes', {
      id,
      client_id: cliente,
      anomalia_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Anomalias', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      resultado: { type: Sequelize.STRING(20), allowNull: false },
      motivo: { type: Sequelize.STRING },
      revisado_em: { type: Sequelize.DATE, allowNull: false },
      ...datas,
    });
    await queryInterface.addIndex('Anomalia_revisoes', ['client_id', 'anomalia_id', 'revisado_em'], {
      name: 'anomalia_rev_client_anomalia_idx',
    });

    // registro de cada execução do job (cursor do processamento incremental e métricas)
    await queryInterface.createTable('Anomalia_execucoes', {
      id,
      client_id: cliente,
      modo: { type: Sequelize.STRING(20), allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false },
      inicio: { type: Sequelize.DATE, allowNull: false },
      fim: { type: Sequelize.DATE },
      periodo_inicio: { type: Sequelize.DATE },
      periodo_fim: { type: Sequelize.DATE },
      resumo: { type: Sequelize.JSON },
      erro: { type: Sequelize.TEXT },
      versao_modelo: { type: Sequelize.STRING(20), allowNull: false },
      ...datas,
    });
    await queryInterface.addIndex('Anomalia_execucoes', ['client_id', 'modo', 'status', 'periodo_fim'], {
      name: 'anomalia_exec_client_modo_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('Anomalia_execucoes');
    await queryInterface.dropTable('Anomalia_revisoes');
    await queryInterface.dropTable('Anomalias');
    await queryInterface.dropTable('Anomalia_estados');
    await queryInterface.dropTable('Anomalia_referencias');
  },
};
