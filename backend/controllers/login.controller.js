const { User } = require('../models');
const JWT = require('jsonwebtoken');

class LoginController {
  async login({ email, password }, h) {
    return new Promise(async (resolve, reject) => {
      const user = await User.findOne({ where: { email } });
      if (user && user.active) {
        if (User.validPassword(password, user.password)) {
          const token = JWT.sign({ id: user.id }, process.env.JWT_KEY);
          resolve({ token, email, name: user.name, admin: user.admin, admin_client: user.admin_client });
        } else {
          resolve(h.response({ error: 'Usuário inexistente ou credencial inválida' }).code(401));
        }
      } else {
        resolve(h.response({ error: 'Usuário inexistente ou credencial inválida' }).code(401));
      }
    });
  }
}

module.exports = new LoginController();
