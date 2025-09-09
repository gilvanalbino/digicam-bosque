'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = {
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASS,
  database: process.env.DATABASE_NAME,
  host: process.env.DATABASE_HOST,
  dialect: process.env.DATABASE_DIALECT,
  logging: false, // process.env.NODE_ENV === 'production' ? false : console.log,
  pool: {
    max: 20,           // Máximo de conexões no pool
    min: 5,            // Mínimo de conexões mantidas
    idle: 30000,       // 30s timeout para conexões idle
    acquire: 60000,    // 60s timeout para obter conexão do pool
    evict: 1000,       // Verifica conexões expiradas a cada 1s
    handleDisconnects: true  // Reconecta automaticamente em caso de desconexão
  },
  dialectOptions: {
    connectTimeout: 60000,     // 60s timeout para conectar ao MySQL
    acquireTimeout: 60000,     // 60s timeout para adquirir conexão
    timeout: 60000,            // 60s timeout para queries
    reconnect: true,           // Reconectar automaticamente
    idleTimeout: 300000        // 5min timeout para conexões idle no MySQL
  },
  retry: {
    match: [
      /ETIMEDOUT/,
      /EHOSTUNREACH/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /ENOTFOUND/,
      /ER_CON_COUNT_ERROR/,
      /PROTOCOL_CONNECTION_LOST/,
      /ER_CONNECTION_KILLED/
    ],
    max: 3  // Máximo de 3 tentativas de reconexão
  }
}; // require(__dirname + '/../config/config.json')[env];
const db = {};

console.log('sequelize config:', config);

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs.readdirSync(__dirname)
  .filter((file) => {
    return file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js';
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
