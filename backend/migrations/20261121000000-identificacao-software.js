'use strict';
// Identificação de entradas e saídas por software (docs/plano_identificacao_placas_software.md):
// tabela Identificacoes (uma linha por passagem, com a leitura da câmera e a do software) e os campos novos.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Identificacoes', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      client_id: { type: Sequelize.INTEGER, allowNull: false },
      camera_id: { type: Sequelize.INTEGER, allowNull: false },
      sentido: { type: Sequelize.STRING(1), allowNull: false },
      // camera | software | ambos
      origem: { type: Sequelize.STRING(10), allowNull: false },
      placa_camera: { type: Sequelize.STRING(10) },
      placa_software: { type: Sequelize.STRING(10) },
      confianca_software: { type: Sequelize.DECIMAL(4, 3) },
      leituras_software: { type: Sequelize.INTEGER },
      classe_veiculo: { type: Sequelize.STRING(12) },
      placa_operador: { type: Sequelize.STRING(10) },
      placa_final: { type: Sequelize.STRING(10) },
      // camera | software | green_list | operador
      fonte_placa_final: { type: Sequelize.STRING(12) },
      divergente: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      software_ligado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      instante_camera: { type: Sequelize.DATE(3) },
      instante_software_inicio: { type: Sequelize.DATE(3) },
      instante_software: { type: Sequelize.DATE(3) },
      // entrada | saida | nenhuma (direção vista pelo software ao cruzar a linha)
      direcao_software: { type: Sequelize.STRING(8) },
      identificador_placa: { type: Sequelize.STRING },
      rastro_software: { type: Sequelize.STRING(64), unique: true },
      foto_software: { type: Sequelize.STRING },
      foto_software_thumb: { type: Sequelize.STRING },
      foto_software_placa: { type: Sequelize.STRING },
      trafego_id: { type: Sequelize.INTEGER },
      saida_nao_identificada_id: { type: Sequelize.INTEGER },
      // aguardando | concluida | descartada
      situacao: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'aguardando' },
      historico: { type: Sequelize.JSON },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex('Identificacoes', ['camera_id', 'instante_camera']);
    await queryInterface.addIndex('Identificacoes', ['camera_id', 'instante_software_inicio']);
    await queryInterface.addIndex('Identificacoes', ['identificador_placa']);
    await queryInterface.addIndex('Identificacoes', ['trafego_id']);
    await queryInterface.addIndex('Identificacoes', ['situacao', 'origem']);

    await queryInterface.addColumn('Cameras', 'identificacao_software', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('Cameras', 'config_software', { type: Sequelize.JSON });
    await queryInterface.addColumn('Trafegos', 'identificacao_entrada_id', { type: Sequelize.INTEGER });
    await queryInterface.addColumn('Trafegos', 'identificacao_saida_id', { type: Sequelize.INTEGER });
    await queryInterface.addColumn('Saidas_nao_identificadas', 'identificacao_id', { type: Sequelize.INTEGER });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Saidas_nao_identificadas', 'identificacao_id');
    await queryInterface.removeColumn('Trafegos', 'identificacao_saida_id');
    await queryInterface.removeColumn('Trafegos', 'identificacao_entrada_id');
    await queryInterface.removeColumn('Cameras', 'config_software');
    await queryInterface.removeColumn('Cameras', 'identificacao_software');
    await queryInterface.dropTable('Identificacoes');
  },
};
