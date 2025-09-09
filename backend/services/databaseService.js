/**
 * ARQUIVO DEPRECIADO
 * 
 * Este arquivo foi substituído por sequelizeDatabaseService.js
 * 
 * Problemas identificados neste arquivo:
 * - Conexão singleton sem reconexão automática
 * - Sem pool de conexões
 * - Sem tratamento adequado de timeouts
 * - Sem retry logic em caso de falhas
 * - Uso direto do mysql2 em vez do Sequelize
 * 
 * As funções foram migradas para usar Sequelize com:
 * - Pool de conexões configurado
 * - Timeouts adequados
 * - Reconexão automática
 * - Retry logic
 * - Melhor tratamento de erros
 * 
 * @deprecated Use sequelizeDatabaseService.js
 */

console.warn('WARNING: databaseService.js is deprecated. Use sequelizeDatabaseService.js instead');

// Re-export das funções do novo service para compatibilidade temporária
module.exports = require('./sequelizeDatabaseService');
