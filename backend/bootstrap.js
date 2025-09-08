const { User } = require('./models');

const init = async () => {
  const defaultUsers = [
    {
      name: 'System User',
      email: 'system@digicam.com.br',
      password: 'digicam@2009',
      active: true,
      admin: true,
      admin_client: false,
      client_id: null,
    },
    {
      name: 'Gilvan Albino de Souza',
      email: 'gilvan.souza@efabrika.com.br',
      password: '12341234',
      active: true,
      admin: true,
      admin_client: false,
      client_id: null,
    },
    {
      name: 'Robson Ribeiro',
      email: 'redribeiro@gmail.com',
      password: 'bonavita',
      active: true,
      admin: true,
      admin_client: false,
      client_id: null,
    },
  ];

  const dbUsers = await User.findAll();

  return defaultUsers.map(async (user) => {
    const existe = dbUsers.filter((dbUser) => dbUser.email === user.email);
    if (existe.length == 0) {
      return await User.create(user);
    }
  });
};

module.exports = init;
