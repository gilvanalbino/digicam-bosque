'use strict';

const { sequelize } = require('./models');

async function init() {
  return await sequelize.authenticate();
}

module.exports = init;
