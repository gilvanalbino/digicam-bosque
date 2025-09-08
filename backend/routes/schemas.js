const Joi = require('joi');

/*****
 * LOGIN
 */
const loginSchema = Joi.object()
  .keys({
    email: Joi.string().required().description('Email do usuário'),
    password: Joi.string().required().description('Informa a senha do usuário'),
  })
  .label('Login');

const loginResponseSchema = Joi.object()
  .keys({
    token: Joi.string().required().description('Token JWT'),
  })
  .label('LoginResponse');

/********
 * USERS
 ********/
const commonUserAttributes = {
  name: Joi.string().required().description('Nome do usuário'),
  email: Joi.string().required().description('Email do usuário'),
  password: Joi.string().required().description('Informa a senha do usuário'),
  active: Joi.boolean().required().description('Indicador se o usuário está ativo'),
  admin: Joi.boolean().required().description('Indicador se o usuário é administrador'),
  admin_client: Joi.boolean().required().description('Indicador se o usuário é administrador do cliente'),
  client_id: Joi.number().description('Id do cliente que o usuário pertente'),
};

const idUserAttribute = { id: Joi.number().required().description('Id do usuário') };

const userIdSchema = Joi.object().keys(idUserAttribute);

const userSchema = Joi.object().keys(commonUserAttributes).label('User');

const userSavedSchema = Joi.object()
  .keys({
    id: idUserAttribute.id,
    ...commonUserAttributes,
  })
  .label('UserDB');

/***********
 * CLIENTES
 ***********/

const commonClientAttributes = {
  name: Joi.string().required().description('Nome do cliente'),
  type: Joi.string().required().description('Tipo do cliente - PF ou PJ'),
  cpfCnpj: Joi.string().required().description('CPF ou CNPJ do cliente, de acordo com o tipo'),
  cep: Joi.string().required().description('CEP do cliente'),
  address: Joi.string().required().description('Endereço do cliente - nome da rua'),
  number: Joi.string().required().description('Número do endereço do cliente'),
  district: Joi.string().required().description('Bairro do cliente'),
  city: Joi.string().required().description('Cidade do cliente'),
  state: Joi.string().required().description('Estado do cliente'),
  active: Joi.boolean().required().description('Indicador se o cliente está ativo'),
  entrada_automatica: Joi.boolean().required().description('Indicador para ação de entrada automática'),
  tocar_alarme: Joi.boolean().required().description('Indicador para tocar alarme'),
};

const idClientAttribute = { id: Joi.number().required().description('Id do cliente') };

const clientSchema = Joi.object().keys(commonClientAttributes).label('Cliente');

const clientSavedSchema = Joi.object()
  .keys({
    id: idClientAttribute.id,
    ...commonClientAttributes,
  })
  .label('ClienteDB');

const clientIdSchema = Joi.object().keys({ id: idClientAttribute });

/***********
 * CAMERAS
 ***********/

const commonCameraAttributes = {
  nome: Joi.string().required().description('Nome da camera'),
  url: Joi.string().required().description('URL de acesso à camera'),
  modelo: Joi.string().required().description('Modelo da camera'),
  sentido: Joi.string().required().description('Sentido da camera - (E)entrada, (S)saída ou (E/S)'),
  posicionamento: Joi.string().required().description('Posicionamento da camera - (F)Frente ou (T)Traseira do veículo'),
  client_id: Joi.number().required().description('Id do cliente a que pertence a camera'),
  portaria_id: Joi.number().required().description('Id da portaria que a camera está'),
  login: Joi.string().description('login para acesso à API da camera'),
  senha: Joi.string().description('senha para acesso à API da camera'),
};

const idCameraAttribute = { id: Joi.number().required().description('Id da camera') };

const cameraSchema = Joi.object().keys(commonCameraAttributes).label('Camera');

const cameraSavedSchema = Joi.object()
  .keys({
    id: idCameraAttribute.id,
    ...commonCameraAttributes,
  })
  .label('CameraDB');

const cameraIdSchema = Joi.object().keys({ id: idCameraAttribute });

/***********
 * TRAFEGOS
 ***********/

const commonTrafegoAttributes = {
  nome: Joi.string().allow(null, '').description('Nome do motorista'),
  placa: Joi.string().required().description('Placa do carro'),
  dataEntrada: Joi.date().required().description('Data da entrada'),
  dataSaida: Joi.date().allow(null, '').description('Data de saída'),
  destino: Joi.string().required().description('Destino'),
  morador_destino_id: Joi.number().allow(null).description('Destino'),
  observacao: Joi.string().allow(null, '').description('Observação'),
  client_id: Joi.number().required().description('Id do cliente a que pertence o trafego'),
  imagem: Joi.string().required().description('Imagem do veículo em base64'),
  portaria_entrada_id: Joi.number().required().description('Portaria entrada do carro'),
  portaria_saida_id: Joi.number().allow(null).description('Portaria saída do carro'),
  logIdentificacaoId: Joi.number().allow(null).description('Id LogIdentificacao usado para criar o trafego'),
};

const idTrafegoAttribute = { id: Joi.number().required().description('Id do trafego') };

const trafegoSchema = Joi.object().keys(commonTrafegoAttributes).label('Trafego');

const trafegoSavedSchema = Joi.object()
  .keys({
    id: idTrafegoAttribute.id,
    nome: Joi.string().allow(null, '').description('Nome do motorista'),
    placa: Joi.string().required().description('Placa do carro'),
    destino: Joi.string().required().description('Destino'),
    morador_destino_id: Joi.number().allow(null).description('Destino'),
    observacao: Joi.string().allow(null, '').description('Observação'),
  })
  .label('TrafegoDB');

const trafegoIdSchema = Joi.object().keys({ id: idTrafegoAttribute });

/***********
 * MORADORES
 ***********/

const commonMoradorAttributes = {
  nome: Joi.string().required().description('Nome do morador'),
  endereco: Joi.string().required().description('Endereço do morador'),
  observacao: Joi.string().allow(null, '').description('Observação sobre o morador'),
  client_id: Joi.number().required().description('Id do cliente a quem pertence o morador'),
};

const idMoradorAttribute = { id: Joi.number().required().description('Id do morador') };

const moradorSchema = Joi.object().keys(commonMoradorAttributes).label('Morador');

const moradorSavedSchema = Joi.object()
  .keys({
    id: idMoradorAttribute.id,
    ...commonMoradorAttributes,
  })
  .label('MoradorDB');

const moradorIdSchema = Joi.object().keys({ id: idMoradorAttribute });

/***********
 * CARROS
 ***********/

const commonCarroAttributes = {
  placa: Joi.string().required().description('Placa do carro'),
  modelo: Joi.string().required().description('Modelo do carro'),
  cor: Joi.string().required().description('Cor do carro'),
  morador_id: Joi.number().required().description('Id do morador a quem pertence o carro'),
};

const idCarroAttribute = { id: Joi.number().required().description('Id do morador') };

const carroSchema = Joi.object().keys(commonCarroAttributes).label('Carro');

const carroSavedSchema = Joi.object()
  .keys({
    id: idCarroAttribute.id,
    ...commonCarroAttributes,
  })
  .label('CarroDB');

const carroIdSchema = Joi.object().keys({ id: idCarroAttribute });

/***********
 * PORTARIA
 ***********/

const commonPortariaAttributes = {
  nome: Joi.string().required().description('Nome do portaria'),
  client_id: Joi.number().required().description('Id do cliente a quem pertence a portaria'),
};

const idPortariaAttribute = { id: Joi.number().required().description('Id da portaria') };

const portariaSchema = Joi.object().keys(commonPortariaAttributes).label('Portaria');

const portariaSavedSchema = Joi.object()
  .keys({
    id: idPortariaAttribute.id,
    ...commonPortariaAttributes,
  })
  .label('PortariaDB');

const portariaIdSchema = Joi.object().keys({ id: idPortariaAttribute });

/********************
 * LOG IDENTIFICACAO
 ********************/

const commonLogIdentificacaoAttributes = {
  placa: Joi.string().required().description('Placa Identificada'),
  sentido: Joi.string().required().description('Sentido do movimento'),
  data: Joi.date().required().description('Data/hora da identificação'),
  camera_id: Joi.number().required().description('Camera que identificou a placa'),
  picname: Joi.string().required().description('Nome da foto para placa e carro, gerado pela camera'),
};

const idLogIdentificacaoAttribute = { id: Joi.number().required().description('Id do LogIdentificacao') };

const logIdentificacaoSchema = Joi.object().keys(commonLogIdentificacaoAttributes).label('LogIdentificacao');

const logIdentificacaoSavedSchema = Joi.object()
  .keys({
    id: idLogIdentificacaoAttribute.id,
    ...commonLogIdentificacaoAttributes,
  })
  .label('LogIdentificacaoDB');

const logIdentificacaoIdSchema = Joi.object().keys({ id: idLogIdentificacaoAttribute });

/***********
 * WhiteList
 ***********/

const commonWhiteListAttributes = {
  placa: Joi.string().required().description('Placa do veículo'),
  marca: Joi.string().required().description('Marca do veículo'),
  modelo: Joi.string().required().description('Modelo do veículo'),
  nome: Joi.string().required().description('Nome do priprietário'),
  endereco: Joi.string().description('Endereço do proprietário'),
  numero: Joi.string().description('Número da casa'),
  complemento: Joi.string().description('Complemento do endereço'),
  client_id: Joi.number().required().description('Id do cliente a quem pertence a portaria'),
};

const idWhiteListAttribute = { id: Joi.number().required().description('Id da portaria') };

const whiteListSchema = Joi.object().keys(commonWhiteListAttributes).label('WhiteList');

const whiteListSavedSchema = Joi.object()
  .keys({
    id: idWhiteListAttribute.id,
    ...commonWhiteListAttributes,
  })
  .label('WhiteListDB');

const whiteListIdSchema = Joi.object().keys({ id: idWhiteListAttribute });

/***********
 * BlackList
 ***********/

const commonBlackListAttributes = {
  placa: Joi.string().required().description('Placa do veículo'),
  marca: Joi.string().allow(null, '').description('Marca do veículo'),
  modelo: Joi.string().allow(null, '').description('Modelo do veículo'),
  motivo: Joi.string().allow(null, '').description('Nome do priprietário'),
  client_id: Joi.number().required().description('Id do cliente a quem pertence a portaria'),
};

const idBlackListAttribute = { id: Joi.number().required().description('Id da portaria') };

const blackListSchema = Joi.object().keys(commonBlackListAttributes).label('BlackList');

const blackListSavedSchema = Joi.object()
  .keys({
    id: idBlackListAttribute.id,
    ...commonBlackListAttributes,
  })
  .label('BlackListDB');

const blackListIdSchema = Joi.object().keys({ id: idBlackListAttribute });

/** COMMON */
const responseSchema = Joi.object({
  status: Joi.string(),
  message: Joi.string(),
});

module.exports = {
  responseSchema,

  loginSchema,
  loginResponseSchema,

  userIdSchema,
  userSchema,
  userSavedSchema,

  clientIdSchema,
  clientSchema,
  clientSavedSchema,

  cameraIdSchema,
  cameraSchema,
  cameraSavedSchema,

  trafegoIdSchema,
  trafegoSchema,
  trafegoSavedSchema,

  moradorIdSchema,
  moradorSchema,
  moradorSavedSchema,

  carroIdSchema,
  carroSchema,
  carroSavedSchema,

  portariaSchema,
  portariaSavedSchema,
  portariaIdSchema,

  logIdentificacaoSchema,
  logIdentificacaoSavedSchema,
  logIdentificacaoIdSchema,

  whiteListSchema,
  whiteListSavedSchema,
  whiteListIdSchema,

  blackListSchema,
  blackListSavedSchema,
  blackListIdSchema,
};
