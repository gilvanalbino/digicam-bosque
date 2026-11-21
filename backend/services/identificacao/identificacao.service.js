'use strict';
/**
 * Conciliação entre a leitura da câmera e a do software (docs/plano_identificacao_placas_software.md, seção 7).
 * Cada veículo que passa por uma câmera vira uma linha em Identificacoes com as duas leituras; a placa final dessa
 * linha é a que o fluxo de entrada e saída usa. As operações de uma mesma câmera são serializadas no processo, para a
 * leitura da câmera e o evento do software do mesmo veículo não criarem duas linhas.
 */
const { Op } = require('sequelize');
const { Identificacao, Camera, Trafego, SaidaNaoIdentificada, LogIdentificacao, User } = require('../../models');
const regras = require('./regras');
const fileService = require('../file.service');
const whiteListService = require('../whiteList.service');
const blackListService = require('../blackList.service');
const trafegoService = require('../trafego.service');
const saidaNaoIdentificadaService = require('../saidaNaoIdentificada.service');

const log = (...a) => console.log('[identificacao]', ...a);

// ---------------- serialização por câmera

const filas = new Map();
const serializar = (cameraId, tarefa) => {
  const anterior = filas.get(cameraId) || Promise.resolve();
  const atual = anterior.catch(() => {}).then(tarefa);
  filas.set(cameraId, atual.catch(() => {}));
  return atual;
};

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const adicionarHistorico = (identificacao, evento) => {
  identificacao.historico = [...(identificacao.historico || []), regras.eventoHistorico(evento.tipo, evento)];
};

// usuário usado nas ações que o próprio sistema dispara (varredura): o último usuário de serviço que enviou eventos
// do software ou, na falta dele, um administrador
let usuarioSistema = null;
const obterUsuarioSistema = async () => {
  if (usuarioSistema) return usuarioSistema;
  const admin = await User.findOne({ where: { admin: true }, attributes: ['id'] });
  return admin ? admin.id : null;
};

// ---------------- placa: red list e green list

const naRedList = async (loggedUserId, clientId, placa) =>
  !!placa && !!(await blackListService.findByPlaca(loggedUserId, clientId, placa));

/** Aplica a correção da green list sobre a placa decidida; devolve { placa, fonte }. */
const corrigirPelaGreenList = async (clientId, placa, fonte, redList) => {
  if (!placa || redList) return { placa, fonte };
  const corrigida = await whiteListService.obterPlacaCorrigida(clientId, placa);
  return corrigida && corrigida !== placa ? { placa: corrigida, fonte: 'green_list' } : { placa, fonte };
};

// ---------------- leitura da câmera (chamada por insertLogIdentificacao)

const candidatasSoftware = (camera) =>
  Identificacao.findAll({
    where: {
      camera_id: camera.id,
      origem: 'software',
      identificador_placa: null,
      situacao: 'aguardando',
      instante_software_inicio: { [Op.gte]: new Date(Date.now() - 15 * 60 * 1000) },
    },
  });

/**
 * Registra a leitura da câmera e decide a placa a usar. Com o software ligado, procura a passagem do software do
 * mesmo veículo e, se ainda não houver, espera até 5 s por ela. Retorna { identificacao, placa }.
 * `leitura`: { placa (como a câmera leu), data, identificador_placa }.
 */
const registrarLeituraCamera = async (loggedUserId, camera, leitura) => {
  const ligado = !!camera.identificacao_software;
  if (ligado) {
    // espera fora da fila da câmera, para não segurar os eventos do software que podem chegar nesse tempo
    const limite = Date.now() + regras.ESPERA_SOFTWARE_MS;
    while (Date.now() < limite) {
      const achou = regras.escolherSoftwareParaCamera(await candidatasSoftware(camera), leitura.data, leitura.placa);
      if (achou && achou.placa_software) break;
      await esperar(500);
    }
  }
  return serializar(camera.id, async () => {
    const redList = await naRedList(loggedUserId, camera.client_id, leitura.placa);
    const software = ligado
      ? regras.escolherSoftwareParaCamera(await candidatasSoftware(camera), leitura.data, leitura.placa)
      : null;
    const decisao = regras.decidirPlaca({
      placaCamera: leitura.placa,
      placaSoftware: software && software.placa_software,
      softwareLigado: ligado,
      placaCameraNaRedList: redList,
      leiturasSoftware: software ? software.leituras_software : undefined,
    });
    const final = await corrigirPelaGreenList(camera.client_id, decisao.placa, decisao.fonte, redList);
    const dados = {
      placa_camera: leitura.placa,
      instante_camera: leitura.data,
      identificador_placa: leitura.identificador_placa,
      placa_final: final.placa,
      fonte_placa_final: final.fonte,
      divergente: decisao.divergente,
      software_ligado: ligado,
    };
    let identificacao;
    if (software) {
      identificacao = software;
      identificacao.set({ ...dados, origem: 'ambos' });
      adicionarHistorico(identificacao, { tipo: 'leitura_camera', placa: leitura.placa, placa_final: final.placa });
    } else {
      identificacao = Identificacao.build({
        ...dados,
        client_id: camera.client_id,
        camera_id: camera.id,
        sentido: camera.sentido,
        origem: 'camera',
        // com o software ligado, a linha espera a leitura dele por alguns minutos (correção da seção 7.4)
        situacao: ligado ? 'aguardando' : 'concluida',
        historico: [regras.eventoHistorico('leitura_camera', { placa: leitura.placa, placa_final: final.placa })],
      });
    }
    await identificacao.save();
    if (final.placa !== leitura.placa) {
      log(`câmera ${camera.id}: ${leitura.placa} -> ${final.placa} (${final.fonte})`);
    }
    return { identificacao, placa: final.placa };
  });
};

/** Placa final atual de uma leitura da câmera (pode ter sido corrigida pelo software depois da leitura). */
const placaAtual = async (identificadorPlaca) => {
  const identificacao = await Identificacao.findOne({ where: { identificador_placa: identificadorPlaca } });
  return identificacao ? identificacao.placa_final : null;
};

/** Liga a identificação ao Trafego da entrada ou da saída. */
const vincularTrafego = async (identificadorPlaca, trafego, tipo) => {
  if (!trafego || !identificadorPlaca) return;
  const identificacao = await Identificacao.findOne({ where: { identificador_placa: identificadorPlaca } });
  if (!identificacao) return;
  identificacao.trafego_id = trafego.id;
  await identificacao.save();
  const campo = tipo === 'saida' ? 'identificacao_saida_id' : 'identificacao_entrada_id';
  await Trafego.update({ [campo]: identificacao.id }, { where: { id: trafego.id } });
};

/** Liga a identificação à saída sem entrada criada para ela. */
const vincularSaidaNaoIdentificada = async (saida) => {
  if (!saida || !saida.identificador_placa) return;
  const identificacao = await Identificacao.findOne({ where: { identificador_placa: saida.identificador_placa } });
  if (!identificacao) return;
  identificacao.saida_nao_identificada_id = saida.id;
  await identificacao.save();
  await SaidaNaoIdentificada.update({ identificacao_id: identificacao.id }, { where: { id: saida.id } });
};

// ---------------- eventos do software

const salvarFotosSoftware = async (camera, evento, placa) => {
  if (!evento.foto) return {};
  const agora = new Date();
  const pasta = `/${agora.getFullYear()}/${agora.getMonth() + 1}/${agora.getDate()}`;
  const nome = `${placa || 'SEMPLACA'}-sw${camera.id}-${agora.getHours()}-${agora.getMinutes()}-${agora.getSeconds()}`;
  await fileService.saveFile(evento.foto, pasta, nome, true);
  const fotos = { foto_software: `${pasta}/${nome}.jpg`, foto_software_thumb: `${pasta}/${nome}_thumb.jpg` };
  if (evento.foto_placa) {
    await fileService.saveFile(evento.foto_placa, pasta, `${nome}-placa`, false);
    fotos.foto_software_placa = `${pasta}/${nome}-placa.jpg`;
  }
  return fotos;
};

const candidatasCamera = (camera) =>
  Identificacao.findAll({
    where: {
      camera_id: camera.id,
      origem: 'camera',
      rastro_software: null,
      instante_camera: { [Op.gte]: new Date(Date.now() - 15 * 60 * 1000) },
    },
  });

/**
 * Leitura ou passagem enviada pelo software. `evento`: { camera_id, rastro, inicio, instante?, direcao?, placa?,
 * confianca?, leituras?, classe?, foto?, foto_placa? }. Idempotente pelo `rastro`.
 */
const registrarEventoSoftware = async (loggedUserId, evento, tipo) => {
  usuarioSistema = loggedUserId;
  const camera = await Camera.findByPk(evento.camera_id);
  if (!camera) return { status: 'ERROR', message: 'Câmera não encontrada' };
  const placa = regras.normalizarPlaca(evento.placa);
  const placaSoftware = regras.placaValida(placa) ? placa : null;

  return serializar(camera.id, async () => {
    let identificacao = await Identificacao.findOne({ where: { rastro_software: evento.rastro } });
    const novo = !identificacao;
    if (novo) {
      identificacao = regras.escolherCameraParaSoftware(
        await candidatasCamera(camera),
        {
          instante_software_inicio: evento.inicio,
          instante_software: evento.instante,
          placa_software: placaSoftware,
        }
      );
      if (identificacao) {
        identificacao.origem = 'ambos';
      } else {
        identificacao = Identificacao.build({
          client_id: camera.client_id,
          camera_id: camera.id,
          sentido: camera.sentido,
          origem: 'software',
          situacao: 'aguardando',
          software_ligado: !!camera.identificacao_software,
          historico: [],
        });
      }
      identificacao.rastro_software = evento.rastro;
      identificacao.instante_software_inicio = new Date(evento.inicio);
    }
    const placaAnterior = identificacao.placa_software;
    if (placaSoftware) {
      identificacao.placa_software = placaSoftware;
      identificacao.confianca_software = evento.confianca ?? identificacao.confianca_software;
      identificacao.leituras_software = evento.leituras ?? identificacao.leituras_software;
    }
    if (evento.classe) identificacao.classe_veiculo = evento.classe;
    if (tipo === 'passagem') {
      identificacao.instante_software = new Date(evento.instante || Date.now());
      identificacao.direcao_software = evento.direcao || 'nenhuma';
    }
    if (evento.foto && (!identificacao.foto_software || (placaSoftware && placaSoftware !== placaAnterior))) {
      Object.assign(identificacao, await salvarFotosSoftware(camera, evento, placaSoftware));
    }
    if (placaSoftware !== placaAnterior || tipo === 'passagem') {
      adicionarHistorico(identificacao, { tipo: `${tipo}_software`, placa: placaSoftware, direcao: evento.direcao });
    }
    if (identificacao.placa_camera && identificacao.placa_software) {
      identificacao.divergente = identificacao.placa_camera !== identificacao.placa_software;
    }
    await identificacao.save();

    // o software chegou depois da câmera com outra placa: corrige no mesmo registro (seção 7.4)
    if (identificacao.origem === 'ambos' && camera.identificacao_software && placaSoftware) {
      await corrigirDepoisDoFato(loggedUserId, camera, identificacao);
    }
    return { status: 'OK', id: identificacao.id, origem: identificacao.origem };
  });
};

// ---------------- correção depois do fato (seção 7.4)

/** O operador mexeu nesta entrada ou saída? Nesse caso vale o valor dele. */
const tocadoPeloOperador = (identificacao, saida) =>
  // placa editada na tela, ou saída associada à mão no painel de saídas
  identificacao.fonte_placa_final === 'operador' ||
  !!(saida && saida.status === 'associada' && !saida.associacao_automatica);

const marcarListas = async (loggedUserId, trafego, placa) => {
  const verde = await whiteListService.findByPlaca(loggedUserId, trafego.client_id, placa);
  const vermelha = await blackListService.findByPlaca(loggedUserId, trafego.client_id, placa);
  trafego.in_whitelist = !!verde;
  trafego.whitelist_id = verde ? verde.id : null;
  trafego.in_blacklist = !!vermelha;
  trafego.blacklist_id = vermelha ? vermelha.id : null;
};

const corrigirDepoisDoFato = async (loggedUserId, camera, identificacao) => {
  const redList = await naRedList(loggedUserId, camera.client_id, identificacao.placa_camera);
  const decisao = regras.decidirPlaca({
    placaCamera: identificacao.placa_camera,
    placaSoftware: identificacao.placa_software,
    softwareLigado: true,
    placaCameraNaRedList: redList,
    leiturasSoftware: identificacao.leituras_software,
  });
  const final = await corrigirPelaGreenList(camera.client_id, decisao.placa, decisao.fonte, redList);
  if (!final.placa || final.placa === identificacao.placa_final) return;

  const ident = identificacao.identificador_placa;
  const saida = ident ? await SaidaNaoIdentificada.findOne({ where: { identificador_placa: ident } }) : null;
  const trafego = ident
    ? await Trafego.findOne({
        where: camera.sentido === 'S' ? { identificador_placa_saida: ident } : { identificador_placa: ident },
      })
    : null;

  if (tocadoPeloOperador(identificacao, saida)) {
    adicionarHistorico(identificacao, { tipo: 'correcao_nao_aplicada', motivo: 'operador', placa: final.placa });
    identificacao.divergente = true;
    await identificacao.save();
    return;
  }

  const anterior = identificacao.placa_final;
  // leitura ainda em processamento (fotos): o fluxo da câmera relê a placa antes de criar a entrada ou a saída
  await LogIdentificacao.update({ placa: final.placa }, { where: { identificador_placa: ident } });

  if (camera.sentido !== 'S') {
    if (trafego && !trafego.dataSaida) {
      trafego.placa = final.placa;
      await marcarListas(loggedUserId, trafego, final.placa);
      await trafego.save();
    }
  } else if (saida && saida.status === 'pendente') {
    await associarSaidaPelaPlaca(loggedUserId, camera, saida, final.placa);
  } else if (saida && saida.status === 'associada' && saida.associacao_automatica && trafego
             && trafego.placa !== final.placa) {
    const melhor = await trafegoService.obterRegistroEntradaSemSaida(loggedUserId, final.placa, saida.data);
    if (melhor && melhor.id !== trafego.id) {
      await saidaNaoIdentificadaService.desassociar(loggedUserId, saida.id);
      await saidaNaoIdentificadaService.associar(loggedUserId, saida.id, melhor.id);
      await SaidaNaoIdentificada.update({ associacao_automatica: true }, { where: { id: saida.id } });
    }
  }
  // saída casada pela placa exata da câmera: fica como está, só marcada como divergente

  identificacao.placa_final = final.placa;
  identificacao.fonte_placa_final = final.fonte;
  identificacao.divergente = true;
  adicionarHistorico(identificacao, { tipo: 'correcao', de: anterior, para: final.placa, fonte: final.fonte });
  await identificacao.save();
  log(`câmera ${camera.id}: corrigida ${anterior} -> ${final.placa} (software chegou depois)`);
};

/** Saída pendente: procura a entrada pela placa do software (exata e depois próxima) e associa. */
const associarSaidaPelaPlaca = async (loggedUserId, camera, saida, placa) => {
  let entrada = await trafegoService.obterRegistroEntradaSemSaida(loggedUserId, placa, saida.data);
  if (!entrada) {
    entrada = await saidaNaoIdentificadaService.obterEntradaPorPlacaProxima(camera.client_id, placa, saida.data);
  }
  if (!entrada) return false;
  const r = await saidaNaoIdentificadaService.associar(loggedUserId, saida.id, entrada.id);
  if (r.status === 'OK') {
    await SaidaNaoIdentificada.update({ associacao_automatica: true }, { where: { id: saida.id } });
    return true;
  }
  return false;
};

// ---------------- passagens vistas só pelo software (seção 7.3)

const criarEntradaPeloSoftware = async (loggedUserId, camera, identificacao) => {
  const ident = identificacao.identificador_placa;
  if (await Trafego.findOne({ where: { identificador_placa: ident } })) return;
  const trafego = Trafego.build({
    nome: '',
    placa: identificacao.placa_final,
    dataEntrada: identificacao.instante_software_inicio,
    destino: 'cruzar',
    client_id: camera.client_id,
    portaria_entrada_id: camera.portaria_id,
    observacao: '',
    imagem: identificacao.foto_software,
    imagem_thumb: identificacao.foto_software_thumb,
    imagem_placa: identificacao.foto_software_placa,
    identificador_placa: ident,
    identificacao_entrada_id: identificacao.id,
    user_reg_entrada: loggedUserId,
  });
  await marcarListas(loggedUserId, trafego, trafego.placa);
  await trafego.save();
  identificacao.trafego_id = trafego.id;
};

const criarSaidaPeloSoftware = async (loggedUserId, camera, identificacao) => {
  const ident = identificacao.identificador_placa;
  const instante = identificacao.instante_software || identificacao.instante_software_inicio;
  const imagens = {
    imagem: identificacao.foto_software,
    imagem_thumb: identificacao.foto_software_thumb,
    imagem_placa: identificacao.foto_software_placa,
  };
  const entrada = await trafegoService.obterRegistroEntradaSemSaida(loggedUserId, identificacao.placa_final, instante, ident);
  if (entrada) {
    trafegoService.aplicarSaidaNoTrafego(entrada, {
      dataSaida: instante,
      placa: identificacao.placa_final,
      identificador_placa: ident,
      portaria_id: camera.portaria_id,
      user_id: loggedUserId,
      automatica: true,
      ...imagens,
    });
    entrada.identificacao_saida_id = identificacao.id;
    await entrada.save();
    identificacao.trafego_id = entrada.id;
    return;
  }
  const saida = {
    placa: identificacao.placa_final,
    identificador_placa: ident,
    data: instante,
    camera_id: camera.id,
    client_id: camera.client_id,
    imagem_carro: imagens.imagem,
    imagem_carro_thumb: imagens.imagem_thumb,
    imagem_placa: imagens.imagem_placa,
    identificacao_id: identificacao.id,
  };
  const proxima = await saidaNaoIdentificadaService.obterEntradaPorPlacaProxima(
    camera.client_id, identificacao.placa_final, instante);
  if (proxima) {
    const trafego = await saidaNaoIdentificadaService.associarAutomaticamente(loggedUserId, saida, proxima.id, camera.portaria_id);
    if (trafego) {
      identificacao.trafego_id = trafego.id;
      await Trafego.update({ identificacao_saida_id: identificacao.id }, { where: { id: trafego.id } });
      return;
    }
  }
  if (!(await SaidaNaoIdentificada.findOne({ where: { identificador_placa: ident } }))) {
    const criada = await saidaNaoIdentificadaService.insert({ ...saida, status: 'pendente' });
    identificacao.saida_nao_identificada_id = criada.id;
  }
};

/**
 * Fecha as passagens do software cujo prazo de casamento com a câmera passou: se a câmera não leu e a identificação
 * por software está ligada, cria a entrada ou registra a saída com a placa do software. Também conclui as leituras
 * da câmera que esperavam o software.
 */
const varrer = async (agora = Date.now()) => {
  const loggedUserId = await obterUsuarioSistema();
  if (!loggedUserId) return;
  const prazo = new Date(agora - regras.TOLERANCIA_MS);
  const pendentes = await Identificacao.findAll({
    where: {
      situacao: 'aguardando',
      origem: 'software',
      [Op.or]: [
        { instante_software: { [Op.lt]: prazo } },
        // passagem que nunca foi informada (o software caiu): desiste depois de 10 min
        { instante_software: null, instante_software_inicio: { [Op.lt]: new Date(agora - 10 * 60 * 1000) } },
      ],
    },
    limit: 200,
  });
  for (const p of pendentes) {
    const camera = await Camera.findByPk(p.camera_id);
    if (!camera) continue;
    await serializar(camera.id, async () => {
      const identificacao = await Identificacao.findByPk(p.id);
      if (!identificacao || identificacao.situacao !== 'aguardando' || identificacao.origem !== 'software') return;
      try {
        if (!identificacao.instante_software || identificacao.direcao_software !== regras.direcaoEsperada(camera.sentido)) {
          identificacao.situacao = 'descartada';
        } else if (!identificacao.placa_software || !camera.identificacao_software) {
          // sem placa (motos: backlog) ou software desligado: só o registro
          identificacao.situacao = 'concluida';
        } else {
          const final = await corrigirPelaGreenList(camera.client_id, identificacao.placa_software, 'software', false);
          identificacao.placa_final = final.placa;
          identificacao.fonte_placa_final = final.fonte;
          identificacao.identificador_placa = `${new Date(identificacao.instante_software_inicio).getTime()}-${final.placa}-sw`;
          if (camera.sentido === 'S') await criarSaidaPeloSoftware(loggedUserId, camera, identificacao);
          else await criarEntradaPeloSoftware(loggedUserId, camera, identificacao);
          identificacao.situacao = 'concluida';
          adicionarHistorico(identificacao, { tipo: camera.sentido === 'S' ? 'saida_pelo_software' : 'entrada_pelo_software', placa: final.placa });
          log(`câmera ${camera.id}: ${camera.sentido === 'S' ? 'saída' : 'entrada'} ${final.placa} registrada só pelo software`);
        }
        await identificacao.save();
      } catch (erro) {
        log(`erro ao concluir identificação ${identificacao.id}:`, erro.message);
      }
    });
  }
  // leituras da câmera que esperavam o software: depois de 3 min ficam concluídas
  await Identificacao.update(
    { situacao: 'concluida' },
    {
      where: {
        situacao: 'aguardando',
        origem: { [Op.in]: ['camera', 'ambos'] },
        updatedAt: { [Op.lt]: new Date(agora - 3 * 60 * 1000) },
      },
    }
  );
};

let varredura = null;
const iniciarVarredura = (intervaloMs = 10 * 1000) => {
  if (varredura) return;
  varredura = setInterval(() => varrer().catch((e) => log('erro na varredura:', e.message)), intervaloMs);
};

// ---------------- edição pelo operador (seção 7.4)

/** O operador trocou a placa de uma entrada: vale a dele, e as leituras anteriores continuam no registro. */
const registrarEdicaoOperador = async (loggedUserId, trafego, placaNova) => {
  const ids = [trafego.identificacao_entrada_id].filter(Boolean);
  const identificacoes = ids.length
    ? await Identificacao.findAll({ where: { id: ids } })
    : trafego.identificador_placa
      ? await Identificacao.findAll({ where: { identificador_placa: trafego.identificador_placa } })
      : [];
  for (const identificacao of identificacoes) {
    if (identificacao.placa_final === placaNova) continue;
    adicionarHistorico(identificacao, { tipo: 'edicao_operador', de: identificacao.placa_final, para: placaNova, usuario: loggedUserId });
    identificacao.placa_operador = placaNova;
    identificacao.placa_final = placaNova;
    identificacao.fonte_placa_final = 'operador';
    await identificacao.save();
  }
};

// ---------------- consultas

const resumoIdentificacao = (i) =>
  i && {
    id: i.id,
    origem: i.origem,
    placa_camera: i.placa_camera,
    placa_software: i.placa_software,
    placa_operador: i.placa_operador,
    fonte_placa_final: i.fonte_placa_final,
    divergente: i.divergente,
  };

/**
 * Acrescenta a cada tráfego o resumo da identificação da entrada e da saída (origem e o texto lido por cada
 * solução), para as telas mostrarem o selo de origem. `trafegos`: instâncias ou objetos com os ids.
 */
const anexarIdentificacoes = async (trafegos) => {
  const ids = new Set();
  for (const t of trafegos) {
    if (t.identificacao_entrada_id) ids.add(t.identificacao_entrada_id);
    if (t.identificacao_saida_id) ids.add(t.identificacao_saida_id);
  }
  const mapa = new Map();
  if (ids.size) {
    for (const i of await Identificacao.findAll({ where: { id: [...ids] }, raw: true })) mapa.set(i.id, i);
  }
  return trafegos.map((t) => {
    const obj = typeof t.toJSON === 'function' ? t.toJSON() : { ...t };
    obj.identificacao_entrada = resumoIdentificacao(mapa.get(t.identificacao_entrada_id)) || null;
    obj.identificacao_saida = resumoIdentificacao(mapa.get(t.identificacao_saida_id)) || null;
    return obj;
  });
};

/** Números da seção 1.1 por câmera, num período. */
const resumo = async (clientId, inicio, fim, cameraId) => {
  const where = { client_id: clientId, createdAt: { [Op.between]: [inicio, fim] } };
  if (cameraId) where.camera_id = cameraId;
  const linhas = await Identificacao.findAll({ where, raw: true });
  const porCamera = {};
  for (const l of linhas) {
    const c = (porCamera[l.camera_id] = porCamera[l.camera_id] || {
      camera_id: l.camera_id, total: 0, camera: 0, software: 0, ambos: 0, divergentes: 0, sem_placa: 0,
      descartadas: 0, criadas_pelo_software: 0, corrigidas: 0, fonte: {},
    });
    if (l.situacao === 'descartada') { c.descartadas += 1; continue; }
    c.total += 1;
    c[l.origem] += 1;
    if (l.divergente) c.divergentes += 1;
    if (!l.placa_final) c.sem_placa += 1;
    if (l.origem === 'software' && l.placa_final) c.criadas_pelo_software += 1;
    if ((l.historico || []).some((h) => h.tipo === 'correcao')) c.corrigidas += 1;
    c.fonte[l.fonte_placa_final || 'nenhuma'] = (c.fonte[l.fonte_placa_final || 'nenhuma'] || 0) + 1;
  }
  return Object.values(porCamera);
};

module.exports = {
  registrarLeituraCamera,
  placaAtual,
  vincularTrafego,
  vincularSaidaNaoIdentificada,
  registrarEventoSoftware,
  varrer,
  iniciarVarredura,
  registrarEdicaoOperador,
  resumo,
  anexarIdentificacoes,
  // para testes
  _serializar: serializar,
};
