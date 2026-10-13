'use strict';

// Importação da green list por planilha Excel (.xlsx). Colunas, nesta ordem:
// Placa, Marca, Modelo, Nome, Endereço, Número, Complemento. A primeira linha pode ser o cabeçalho.
const Excel = require('exceljs');
const { User, WhiteList, sequelize } = require('../models');
const trafegoService = require('./trafego.service');

const COLUNAS = ['placa', 'marca', 'modelo', 'nome', 'endereco', 'numero', 'complemento'];
const MAXIMO_LINHAS = 5000;
const TAMANHO_MAXIMO_CAMPO = 255;

const normalizarPlaca = (placa) => (placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// placa brasileira, padrão antigo (ABC1234) ou Mercosul (ABC1D23)
const placaValida = (placa) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa);

const textoDaCelula = (celula) => (celula && celula.text !== undefined && celula.text !== null ? String(celula.text) : '').trim();

/** Lê uma aba. Linhas vazias e o cabeçalho ficam fora; uma placa repetida vale só na primeira vez. */
const lerAba = (aba) => {
  const linhas = [];
  const erros = [];
  const vistas = new Set();
  aba.eachRow({ includeEmpty: false }, (row, numero) => {
    const valores = COLUNAS.map((_, indice) => textoDaCelula(row.getCell(indice + 1)));
    if (valores.every((valor) => valor === '')) return;
    const placa = normalizarPlaca(valores[0]);
    // cabeçalho: primeira linha cuja primeira coluna não é uma placa
    if (numero === 1 && !placaValida(placa)) return;

    const erro = (motivo) => erros.push({ linha: numero, placa: valores[0], motivo });
    if (!placa) return erro('Placa não informada');
    if (!placaValida(placa)) return erro('Placa fora do padrão (ABC1234 ou ABC1D23)');
    if (vistas.has(placa)) return erro('Placa repetida na planilha');
    if (valores.some((valor) => valor.length > TAMANHO_MAXIMO_CAMPO)) return erro(`Campo com mais de ${TAMANHO_MAXIMO_CAMPO} caracteres`);
    vistas.add(placa);

    const veiculo = { linha: numero, placa };
    COLUNAS.slice(1).forEach((coluna, indice) => (veiculo[coluna] = valores[indice + 1]));
    linhas.push(veiculo);
  });
  return { linhas, erros };
};

/**
 * Lê a planilha: vale a primeira aba que tiver alguma linha de veículo (as vazias são puladas). Retorna
 * { aba, linhas: [{ linha, placa, marca, ... }], erros: [{ linha, placa, motivo }], abas: [{ nome, linhas }] }.
 */
const lerPlanilha = async (conteudo) => {
  const workbook = new Excel.Workbook();
  try {
    await workbook.xlsx.load(conteudo);
  } catch (erro) {
    throw Error('Arquivo inválido: envie uma planilha Excel (.xlsx)');
  }
  if (workbook.worksheets.length === 0) {
    throw Error('A planilha não tem nenhuma aba');
  }
  const abas = workbook.worksheets.map((aba) => ({ nome: aba.name, linhas: aba.rowCount }));
  for (const aba of workbook.worksheets) {
    if (aba.rowCount > MAXIMO_LINHAS + 1) {
      throw Error(`A aba "${aba.name}" tem mais de ${MAXIMO_LINHAS} linhas`);
    }
    const lida = lerAba(aba);
    if (lida.linhas.length + lida.erros.length > 0) {
      return { aba: aba.name, ...lida, abas };
    }
  }
  // nada aproveitável: registra o começo de cada aba para diagnóstico
  for (const aba of workbook.worksheets) {
    const amostra = [];
    aba.eachRow({ includeEmpty: false }, (row, numero) => {
      if (amostra.length < 3) amostra.push({ linha: numero, celulas: (row.values || []).slice(1, 9).map((valor) => (valor && typeof valor === 'object' ? JSON.stringify(valor).slice(0, 80) : valor)) });
    });
    console.log('Importação da green list: aba sem veículos', JSON.stringify({ aba: aba.name, linhas: aba.rowCount, colunas: aba.columnCount, amostra }));
  }
  const descricao = abas.map((aba) => `"${aba.nome}" com ${aba.linhas} linha(s)`).join(', ');
  throw Error(`Nenhum veículo encontrado na planilha (${descricao}). A placa deve estar na primeira coluna, a partir da primeira ou da segunda linha.`);
};

/**
 * Importa a planilha para a green list do cliente: placa nova é incluída; placa já cadastrada tem os dados
 * atualizados pelos da planilha. Linhas inválidas não impedem a importação das demais.
 */
const importar = async (loggedUserId, clientId, conteudo) => {
  const loggedUser = await User.findByPk(loggedUserId);
  if (!loggedUser) {
    throw Error('Informar usuário logado');
  }
  if (!(loggedUser.admin || (loggedUser.client_id && loggedUser.client_id === clientId))) {
    throw Error('Operation not allowed');
  }
  if (!Buffer.isBuffer(conteudo) || conteudo.length === 0) {
    throw Error('Envie a planilha no campo "arquivo"');
  }

  console.log(`Importação da green list: cliente ${clientId}, usuário ${loggedUserId}, arquivo de ${conteudo.length} bytes`);
  const { aba, linhas, erros } = await lerPlanilha(conteudo);

  const cadastrados = new Map();
  for (const veiculo of await WhiteList.findAll({ where: { client_id: clientId } })) {
    const placa = normalizarPlaca(veiculo.placa);
    if (!cadastrados.has(placa)) cadastrados.set(placa, veiculo);
  }

  const novos = [];
  let atualizados = 0;
  let inalterados = 0;
  await sequelize.transaction(async (transaction) => {
    for (const linha of linhas) {
      const dados = {};
      COLUNAS.slice(1).forEach((coluna) => (dados[coluna] = linha[coluna]));
      const existente = cadastrados.get(linha.placa);
      if (!existente) {
        novos.push(await WhiteList.create({ ...dados, placa: linha.placa, client_id: clientId, user_id: loggedUserId }, { transaction }));
      } else if (COLUNAS.slice(1).some((coluna) => (existente[coluna] || '') !== dados[coluna])) {
        await existente.update(dados, { transaction });
        atualizados++;
      } else {
        inalterados++;
      }
    }
  });

  // como no cadastro manual: os tráfegos já registrados com a placa passam a apontar para o veículo
  for (const veiculo of novos) {
    await trafegoService.updateWhiteList(loggedUserId, veiculo);
  }

  const resultado = {
    status: 'OK',
    aba,
    linhas_lidas: linhas.length + erros.length,
    incluidos: novos.length,
    atualizados,
    inalterados,
    erros: erros.sort((a, b) => a.linha - b.linha),
  };
  console.log('Importação da green list: concluída', JSON.stringify({ ...resultado, erros: resultado.erros.length }));
  return resultado;
};

module.exports = { importar, lerPlanilha, COLUNAS };
