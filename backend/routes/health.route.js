const databaseHealth = require('../middleware/database-health');

class HealthRoutes {
  constructor(context) {
    this.context = context;
  }

  static methods() {
    return ['health'];
  }

  health() {
    return {
      method: 'GET',
      path: `/${this.context}/health`,
      config: {
        auth: false, // Health check não precisa de autenticação
        description: 'Health check endpoint',
        tags: ['api', 'health'],
        handler: async (request, h) => {
          try {
            const healthStatus = await databaseHealth.getHealthStatus();
            
            const response = {
              status: 'ok',
              timestamp: new Date().toISOString(),
              service: 'digicam-backend',
              version: '1.0.0',
              database: healthStatus
            };

            // Se o banco não estiver saudável, retorna status 503
            if (healthStatus.status === 'unhealthy') {
              return h.response(response).code(503);
            }

            return h.response(response).code(200);
          } catch (error) {
            console.error('Health check error:', error);
            
            return h.response({
              status: 'error',
              timestamp: new Date().toISOString(),
              service: 'digicam-backend',
              version: '1.0.0',
              error: error.message
            }).code(500);
          }
        }
      }
    };
  }
}

module.exports = HealthRoutes;