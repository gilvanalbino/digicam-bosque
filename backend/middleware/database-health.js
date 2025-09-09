const { sequelize } = require('../models');

/**
 * Middleware para verificar a saúde da conexão com o banco de dados
 */

class DatabaseHealthCheck {
  constructor() {
    this.lastCheck = null;
    this.isHealthy = false;
    this.lastError = null;
    this.checkInterval = 30000; // 30 segundos
    
    // Inicia verificação periódica
    this.startPeriodicCheck();
  }

  /**
   * Verifica se a conexão com o banco está saudável
   */
  async checkHealth() {
    try {
      // Tenta fazer uma query simples
      await sequelize.authenticate();
      
      // Verifica se o pool tem conexões disponíveis
      const poolStatus = sequelize.connectionManager.pool;
      const availableConnections = poolStatus.size - poolStatus.pending;
      
      this.isHealthy = true;
      this.lastCheck = new Date();
      this.lastError = null;
      
      return {
        status: 'healthy',
        timestamp: this.lastCheck,
        pool: {
          total: poolStatus.size,
          available: availableConnections,
          pending: poolStatus.pending,
          max: poolStatus.max,
          min: poolStatus.min
        }
      };
    } catch (error) {
      console.error('Database health check failed:', error);
      
      this.isHealthy = false;
      this.lastCheck = new Date();
      this.lastError = error.message;
      
      return {
        status: 'unhealthy',
        timestamp: this.lastCheck,
        error: this.lastError,
        errorCode: error.code || 'UNKNOWN'
      };
    }
  }

  /**
   * Inicia verificação periódica da saúde do banco
   */
  startPeriodicCheck() {
    setInterval(async () => {
      await this.checkHealth();
    }, this.checkInterval);
    
    // Faz uma verificação inicial
    this.checkHealth();
  }

  /**
   * Middleware para Hapi.js que verifica a saúde antes de processar requests
   */
  getHealthCheckMiddleware() {
    return {
      method: (request, h) => {
        // Se a última verificação foi há mais de 1 minuto e não está saudável
        const oneMinuteAgo = new Date(Date.now() - 60000);
        
        if (!this.isHealthy && this.lastCheck && this.lastCheck < oneMinuteAgo) {
          console.warn('Database appears unhealthy, triggering immediate check');
          // Não await para não bloquear a request
          this.checkHealth();
        }
        
        return h.continue;
      }
    };
  }

  /**
   * Handler para endpoint de health check
   */
  async getHealthStatus() {
    const health = await this.checkHealth();
    
    // Adiciona informações extras
    health.database = {
      dialect: sequelize.getDialect(),
      version: sequelize.options.databaseVersion || 'unknown'
    };
    
    return health;
  }

  /**
   * Tenta reconectar ao banco em caso de falha
   */
  async attemptReconnect() {
    try {
      console.log('Attempting to reconnect to database...');
      await sequelize.close();
      await sequelize.authenticate();
      console.log('Database reconnection successful');
      return true;
    } catch (error) {
      console.error('Database reconnection failed:', error);
      return false;
    }
  }
}

// Singleton instance
const databaseHealth = new DatabaseHealthCheck();

module.exports = databaseHealth;