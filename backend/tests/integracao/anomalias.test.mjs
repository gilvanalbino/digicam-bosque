// Testes de integração do detector de anomalias: job (retroativo, referências, incremental), idempotência,
// API, revisão e isolamento entre clientes.
//
// Usa a mesma pilha descartável de conciliacao.test.mjs (MySQL de teste + backend apontando para ele), com
// dados.sql carregado antes. O job roda dentro do container do backend, por isso BACKEND_CONTAINER é
// obrigatório. O container precisa estar com TZ=America/Bahia.
//
//   npm run test:integracao:anomalias
import { execSync } from 'node:child_process';

const BASE = process.env.API_URL || 'http://localhost:4000/digicam';
const MYSQL_CONTAINER = process.env.MYSQL_CONTAINER || 'digicam-teste-mysql';
const BACKEND_CONTAINER = process.env.BACKEND_CONTAINER;
if (!BACKEND_CONTAINER) {
  console.log('Informe BACKEND_CONTAINER: o job de anomalias roda dentro do container do backend');
  process.exit(1);
}
let falhas = 0;
const ok = (cond, msg, extra) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && extra !== undefined ? ' -> ' + JSON.stringify(extra).slice(0, 600) : ''}`);
  if (!cond) falhas++;
};
const sql = (q) =>
  execSync(`docker exec -i ${MYSQL_CONTAINER} mysql -N -uroot -pteste123 --default-character-set=utf8mb4 digicam_teste`, {
    input: q,
    stdio: ['pipe', 'pipe', 'ignore'],
  }).toString().trim();
const job = (argumentos) => {
  const saida = execSync(`docker exec -w /app ${BACKEND_CONTAINER} node services/anomalia/executar.js ${argumentos}`, {
    stdio: ['pipe', 'pipe', 'ignore'],
  }).toString();
  return saida.split('\n').filter((linha) => linha.startsWith('{"anomalias"')).map((linha) => JSON.parse(linha));
};
const login = async (email, password) =>
  (await (await fetch(`${BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const api = (token) => async (method, path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: token, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return txt; }
};

// ---------------- dados: placa com 40 dias de travessias de 2 minutos às 8h e uma permanência de 2 horas ontem
const HORA = 3600000;
const DIA = 24 * HORA;
// dias no fuso do container (UTC-3)
const diaLocal = (deslocamento) => new Date(Date.now() - 3 * HORA + deslocamento * DIA).toISOString().slice(0, 10);
const oitoDaManha = (deslocamento) => `${diaLocal(deslocamento)} 11:00:00`; // 08:00 local, gravado em UTC
const mysqlData = (texto, minutos) => new Date(new Date(texto.replace(' ', 'T') + 'Z').getTime() + minutos * 60000).toISOString().slice(0, 19).replace('T', ' ');

sql(`DELETE FROM Anomalia_revisoes; DELETE FROM Anomalias; DELETE FROM Anomalia_estados; DELETE FROM Anomalia_referencias; DELETE FROM Anomalia_execucoes;
DELETE FROM Trafegos WHERE id BETWEEN 1000 AND 1999; DELETE FROM Users WHERE email IN ('adm@bosque','adm@outro');
INSERT INTO Users (name,email,password,active,admin,admin_client,client_id,createdAt,updatedAt)
 SELECT 'Admin Bosque','adm@bosque',password,1,0,1,1,NOW(),NOW() FROM Users WHERE email='op@bosque';
INSERT INTO Users (name,email,password,active,admin,admin_client,client_id,createdAt,updatedAt)
 SELECT 'Admin Outro','adm@outro',password,1,0,1,2,NOW(),NOW() FROM Users WHERE email='op@bosque';`);
const linhas = [];
let id = 1000;
const viagem = (placa, cliente, portaria, entrada, minutos) => {
  id++;
  const saida = minutos === null ? 'NULL' : `'${mysqlData(entrada, minutos)}'`;
  const identificador = minutos === null ? 'NULL' : `'an-${id}'`;
  linhas.push(`(${id},'${placa}',${minutos === null ? 'NULL' : `'${placa}'`},'${entrada}',${saida},${identificador},'cruzar',${cliente},${portaria},${portaria},NOW(),NOW())`);
  return id;
};
for (let d = 41; d >= 2; d--) {
  viagem('ANM1A11', 1, 1, oitoDaManha(-d), 2);
  viagem('OUT1A11', 2, 2, oitoDaManha(-d), 2);
  viagem('DEM1A11', 1, 1, oitoDaManha(-d), 2); // sem anomalia no passado; usada no cálculo sob demanda
}
const idAnomalia = viagem('ANM1A11', 1, 1, oitoDaManha(-1), 120);
viagem('OUT1A11', 2, 2, oitoDaManha(-1), 120);
viagem('ABE1A11', 1, 1, oitoDaManha(-1), null); // viagem aberta
sql(`INSERT INTO Trafegos (id,placa,placa_saida,dataEntrada,dataSaida,identificador_placa_saida,destino,client_id,portaria_entrada_id,portaria_saida_id,createdAt,updatedAt) VALUES ${linhas.join(',')}`);
// baixa manual: saída sem leitura de câmera
sql(`INSERT INTO Trafegos (id,placa,dataEntrada,dataSaida,destino,client_id,portaria_entrada_id,createdAt,updatedAt) VALUES (1999,'MAN1A11','${oitoDaManha(-1)}','${mysqlData(oitoDaManha(-1), 30)}','cruzar',1,1,NOW(),NOW())`);

const impressao = () => sql('SELECT COUNT(*), IFNULL(SUM(CRC32(CONCAT_WS("|",id,placa,dataEntrada,IFNULL(dataSaida,""),updatedAt))),0) FROM Trafegos; SELECT COUNT(*), IFNULL(SUM(CRC32(CONCAT_WS("|",id,status,updatedAt))),0) FROM Saidas_nao_identificadas');
const antes = impressao();

// ---------------- carga do histórico: os limites do período são instantes (UTC), não horas locais
const noBackend = (codigo) =>
  JSON.parse(
    execSync(`docker exec -i -w /app ${BACKEND_CONTAINER} node -e "${codigo}"`, { stdio: ['pipe', 'pipe', 'ignore'] })
      .toString().trim().split('\n').pop()
  );
const carregados = noBackend("require('./services/anomalia/dados').carregarHistorico(1, new Date(Date.now()-3600000), new Date()).then((h)=>{console.log(JSON.stringify(h.trafegos.map((t)=>t.id).sort((a,b)=>a-b))); process.exit(0)})");
const esperados = sql('SELECT id FROM Trafegos WHERE client_id=1 AND dataEntrada >= UTC_TIMESTAMP() - INTERVAL 1 HOUR AND dataEntrada < UTC_TIMESTAMP() ORDER BY id').split('\n').filter(Boolean).map(Number);
ok(esperados.length > 0 && JSON.stringify(carregados) === JSON.stringify(esperados), 'carga do histórico: traz exatamente os tráfegos da última hora', { carregados, esperados });

// ---------------- primeira execução: sem carga retroativa
const incrementalEm = (minutos) =>
  noBackend(`require('./services/anomalia/job').executarIncremental(1, new Date(Date.now()+(${minutos})*60000)).then((x)=>{console.log(JSON.stringify(x)); process.exit(0)})`);
let inicial = incrementalEm(-60);
ok(inicial.primeira_execucao === true && inicial.avaliacao.eventos === 0 && inicial.alertas.gerados === 0 && sql('SELECT COUNT(*) FROM Anomalias') === '0',
  'primeira execução: não calcula o passado (a permanência longa de ontem não vira alerta)', inicial);
ok(Number(sql("SELECT COUNT(*) FROM Anomalia_estados WHERE client_id=1 AND chave_veiculo='ANM1A11'")) === 1, 'primeira execução: forma o estado da placa (aquecimento)');
ok(sql("SELECT COUNT(*) FROM Anomalia_execucoes WHERE client_id=1 AND modo='incremental' AND status='OK'") === '1', 'primeira execução: marca o ponto de partida');

// ---------------- job retroativo (uso manual)
let r = job(`--modo=retroativo --cliente=1 --de=${diaLocal(-1)} --ate=${diaLocal(1)}`);
ok(r.length === 1 && r[0].resultado && r[0].resultado.alertas.novos === 1, 'retroativo: gera o alerta da permanência longa', r);
let alerta = sql("SELECT id, client_id, trafego_id, score, status, JSON_EXTRACT(motivos,'$[0]'), JSON_EXTRACT(evidencias,'$.duracao.mediana_s'), JSON_EXTRACT(evidencias,'$.duracao.valor_s'), JSON_EXTRACT(evidencias,'$.composicao.principal'), versao_modelo FROM Anomalias WHERE chave_veiculo='ANM1A11'").split('\t');
ok(alerta[1] === '1' && Number(alerta[2]) === idAnomalia && Number(alerta[3]) >= 80 && alerta[4] === 'ABERTA', 'alerta: do cliente, ligado ao tráfego, prioridade alta e aberto', alerta);
ok(alerta[5] === '"DURACAO_ACIMA"' && alerta[6] === '120' && alerta[7] === '7200' && alerta[8] === '"duracao"', 'alerta: motivo e referência estatística (mediana 2 min, observado 2 h)', alerta);
ok(/^\d+\.\d+\.\d+$/.test(alerta[9]), 'alerta: guarda a versão do modelo', alerta[9]);
const idAlerta = Number(alerta[0]);
ok(sql('SELECT COUNT(*) FROM Anomalias WHERE client_id=2') === '0', 'retroativo de um cliente não gera alerta em outro');

// ---------------- idempotência e reprodutibilidade
const fotografia = () => sql('SELECT id, score, score_duracao, score_frequencia, score_horario, CRC32(evidencias) FROM Anomalias ORDER BY id');
const primeira = fotografia();
r = job(`--modo=retroativo --cliente=1 --de=${diaLocal(-1)} --ate=${diaLocal(1)}`);
ok(r[0].resultado.alertas.novos === 0 && sql('SELECT COUNT(*) FROM Anomalias') === '1', 'idempotência: reprocessar não cria alerta duplicado', r);
ok(fotografia() === primeira, 'reprodutibilidade: mesma versão e mesmos dados dão o mesmo resultado', fotografia());
ok(sql('SELECT COUNT(*) - COUNT(DISTINCT chave_deduplicacao) FROM Anomalias') === '0', 'chave de deduplicação única');
ok(impressao() === antes, 'tabelas operacionais não são alteradas pelo job', impressao());

// ---------------- outro cliente
r = job(`--modo=retroativo --cliente=2 --de=${diaLocal(-1)} --ate=${diaLocal(1)}`);
ok(sql("SELECT COUNT(*) FROM Anomalias WHERE client_id=2 AND chave_veiculo='OUT1A11'") === '1', 'retroativo do outro cliente gera o alerta dele', r);
const idAlertaOutro = Number(sql('SELECT id FROM Anomalias WHERE client_id=2'));

// ---------------- referências e qualidade dos dados
r = job('--modo=referencias --cliente=1');
const dados = r[0].resultado.dados;
ok(dados.viagens.valida >= 41 && dados.viagens.sem_saida >= 2 && dados.viagens.baixa_manual === undefined, 'referências: viagem aberta e baixa manual contadas juntas, como entrada sem saída', dados);
ok(sql("SELECT CONCAT(perfil,'|',qtd_viagens,'|',duracao_mediana) FROM Anomalia_referencias WHERE client_id=1 AND chave_veiculo='ANM1A11'") === 'travessia_frequente|41|120', 'referências: placa com histórico tem referência individual');
ok(Number(sql('SELECT COUNT(*) FROM Anomalia_referencias WHERE client_id=1 AND chave_veiculo IS NULL')) >= 1, 'referências: perfis gravados');
const totalReferencias = sql('SELECT COUNT(*) FROM Anomalia_referencias');
job('--modo=referencias --cliente=1');
ok(sql('SELECT COUNT(*) FROM Anomalia_referencias') === totalReferencias, 'referências: recalcular no mesmo dia substitui, não acumula');

// ---------------- incremental
r = job('--modo=incremental --cliente=1');
ok(r[0].resultado.primeira_execucao === false && r[0].resultado.alertas.gerados === 0, 'incremental: avalia só as passagens posteriores ao ponto de partida, sem alerta novo', r);
r = job('--modo=incremental --cliente=1');
ok(r[0].resultado === null || r[0].resultado.avaliacao.eventos === 0, 'incremental: segunda execução não reavalia o que já foi analisado', r);
ok(sql('SELECT COUNT(*) FROM Anomalias WHERE client_id=1') === '1', 'incremental: continua um alerta só');
ok(Number(sql("SELECT COUNT(*) FROM Anomalia_estados WHERE client_id=1 AND chave_veiculo='ANM1A11'")) === 1, 'incremental: grava o estado de mudança persistente da placa');
ok(sql("SELECT COUNT(*) FROM Anomalia_execucoes WHERE status<>'OK'") === '0', 'execuções registradas sem erro', sql('SELECT modo, status, LEFT(erro,200) FROM Anomalia_execucoes'));
ok(impressao() === antes, 'tabelas operacionais continuam inalteradas');

// ---------------- API: autorização por cliente
const admin = api(await login(process.env.ADMIN_EMAIL || 'system@digicam.com.br', process.env.ADMIN_PASSWORD));
const op = api(await login('op@bosque', 'op123'));
const adm = api(await login('adm@bosque', 'op123'));
const admOutro = api(await login('adm@outro', 'op123'));

r = await adm('GET', '/anomalias/client/1');
ok(r.total === 1 && r.rows[0].placa === 'ANM1A11' && r.rows[0].faixa === 'prioridade_alta' && r.rows[0].motivos[0] === 'DURACAO_ACIMA', 'API: administrador do cliente lista os alertas dele', r);
ok(r.rows[0].evidencias.duracao.mediana_s === 120 && r.rows[0].qualidade_dados.perfil === 'travessia_frequente', 'API: alerta traz evidências e qualidade dos dados', r.rows[0]);
r = await op('GET', '/anomalias/client/1');
ok(r.total === 0 && r.rows.length === 0, 'API: operador comum não vê alertas', r);
r = await adm('GET', '/anomalias/client/2');
ok(r.total === 0, 'API: administrador de um cliente não lista alertas de outro', r);
r = await admin('GET', '/anomalias/client/2');
ok(r.total === 1 && r.rows[0].placa === 'OUT1A11', 'API: administrador do sistema vê qualquer cliente', r);
r = await adm('GET', `/anomalias/${idAlertaOutro}`);
ok(r.status === 'ERROR', 'API: detalhe de alerta de outro cliente é negado', r);
r = await adm('GET', `/anomalias/${idAlerta}`);
ok(r.status === 'OK' && r.anomalia.id === idAlerta && r.trafego && r.trafego.id === idAnomalia && Array.isArray(r.anomalia.evidencias.horario.histograma), 'API: detalhe com evidências completas e o tráfego do evento', r);
r = await adm('GET', '/anomalias/client/1?faixa=observacao');
ok(r.total === 0, 'API: filtro por faixa', r);
r = await adm('GET', '/anomalias/client/1?placa=anm&status=ABERTA&ordem=score&page=1&pageSize=10');
ok(r.total === 1 && r.pageSize === 10, 'API: filtros de placa e status, ordem e paginação', r);
r = await adm('GET', `/anomalias/client/1?de=${encodeURIComponent(new Date(Date.now() + DIA).toISOString())}`);
ok(r.total === 0, 'API: filtro por período', r);

// ---------------- histórico da placa
r = await adm('GET', '/anomalias/client/1/placa/ANM1A11');
ok(r.placa === 'ANM1A11' && r.referencias.length === 1 && r.alertas.length === 1 && r.trafegos.length === 30, 'histórico da placa: referências, alertas e últimos tráfegos', { ref: r.referencias && r.referencias.length, al: r.alertas && r.alertas.length, tr: r.trafegos && r.trafegos.length });
r = await adm('GET', '/anomalias/client/2/placa/OUT1A11');
ok(r.alertas.length === 0 && r.trafegos.length === 0, 'histórico da placa: negado para outro cliente', r);
r = await adm('GET', '/anomalias/client/1/placa/OUT1A11');
ok(r.alertas.length === 0 && r.trafegos.length === 0, 'histórico da placa: placa de outro cliente não aparece neste', r);

// ---------------- revisão
r = await op('POST', `/anomalias/${idAlerta}/revisao`, { resultado: 'DESCARTADA' });
ok(r.status === 'ERROR', 'revisão: operador comum não revisa', r);
r = await admOutro('POST', `/anomalias/${idAlerta}/revisao`, { resultado: 'DESCARTADA' });
ok(r.status === 'ERROR' && sql(`SELECT status FROM Anomalias WHERE id=${idAlerta}`) === 'ABERTA', 'revisão: administrador de outro cliente não revisa', r);
r = await adm('POST', `/anomalias/${idAlerta}/revisao`, { resultado: 'INVALIDO' });
ok(r.statusCode === 400 || r.status === 'ERROR', 'revisão: resultado inválido é recusado', r);
r = await adm('POST', `/anomalias/${idAlerta}/revisao`, { resultado: 'DESCARTADA', motivo: 'Prestador de serviço conhecido' });
ok(r.status === 'OK' && sql(`SELECT status FROM Anomalias WHERE id=${idAlerta}`) === 'DESCARTADA', 'revisão: administrador do cliente descarta o alerta', r);
r = await adm('GET', `/anomalias/${idAlerta}`);
ok(r.anomalia.revisoes.length === 1 && r.anomalia.revisoes[0].motivo === 'Prestador de serviço conhecido' && r.anomalia.revisoes[0].User.name === 'Admin Bosque', 'revisão: decisão, motivo e revisor ficam registrados', r.anomalia.revisoes);
r = job(`--modo=retroativo --cliente=1 --de=${diaLocal(-1)} --ate=${diaLocal(1)}`);
ok(r[0].resultado.alertas.mantidos === 1 && sql(`SELECT status FROM Anomalias WHERE id=${idAlerta}`) === 'DESCARTADA', 'reprocessar não reabre nem altera alerta já revisado', r);

// ---------------- métricas
r = await adm('GET', '/anomalias/client/1/metricas');
ok(r.status === 'OK' && r.total_alertas === 1 && r.por_status.DESCARTADA === 1 && r.proporcao_descartados === 1 && r.alertas_duplicados === 0, 'métricas: volume, revisões e duplicados', r);
ok(r.tempo_medio_revisao_s !== null && r.dados && r.dados.viagens.valida >= 41 && r.execucoes.com_erro === 0 && r.perfis, 'métricas: tempo de revisão, qualidade dos dados e execuções', r);
r = await op('GET', '/anomalias/client/1/metricas');
ok(r.status === 'ERROR', 'métricas: operador comum não acessa', r);
r = await adm('GET', '/anomalias/client/2/metricas');
ok(r.status === 'ERROR', 'métricas: negadas para outro cliente', r);

// ---------------- histórico de veículo que só aparece em saídas sem entrada identificada
{
  sql(`INSERT INTO Saidas_nao_identificadas (id,identificador_placa,placa,data,camera_id,client_id,status,imagem_carro,imagem_carro_thumb,createdAt,updatedAt) VALUES
   (9001,'an-s1','SOS1A11',UTC_TIMESTAMP()-INTERVAL 2 DAY,2,1,'arquivada','/x/s1.jpg','/x/s1_thumb.jpg',NOW(),NOW()),
   (9002,'an-s2','SOS1A11',UTC_TIMESTAMP()-INTERVAL 1 DAY,2,1,'pendente','/x/s2.jpg','/x/s2_thumb.jpg',NOW(),NOW()),
   (9003,'an-s3','SOS1A11',UTC_TIMESTAMP()-INTERVAL 1 DAY,3,2,'pendente',NULL,NULL,NOW(),NOW())`);
  r = await adm('GET', '/anomalias/client/1/placa/SOS1A11');
  ok(r.trafegos.length === 0 && r.saidas.length === 2 && r.saidas[0].id === 9002 && r.saidas[0].imagem_carro_thumb === '/x/s2_thumb.jpg' && r.saidas[0].Camera.portaria_id === 1,
    'histórico: placa sem tráfego traz as saídas sem entrada do próprio cliente, da mais recente para a mais antiga', r);
  sql(`INSERT INTO Anomalias (id,client_id,chave_veiculo,chave_deduplicacao,tipo,ocorrido_em,score,motivos,evidencias,qualidade_dados,versao_modelo,status,createdAt,updatedAt)
   SELECT 9900,1,'SOS1A11','teste-sos','dia',UTC_TIMESTAMP(),40,'[]','{"evento":{"saida_id":9002,"trafego_id":null}}','{}',versao_modelo,'ABERTA',NOW(),NOW() FROM Anomalias LIMIT 1`);
  r = await adm('GET', '/anomalias/9900');
  ok(r.status === 'OK' && r.trafego === null && r.saida && r.saida.id === 9002 && r.saida.imagem_carro === '/x/s2.jpg', 'detalhe: evento de saída sem entrada traz a saída com a foto', r);
  sql('DELETE FROM Anomalias WHERE id=9900; DELETE FROM Saidas_nao_identificadas WHERE id IN (9001,9002,9003)');
}

// ---------------- cálculo sob demanda: o veículo é avaliado quando sai
{
  const minutosAtras = (m) => new Date(Date.now() - m * 60000).toISOString().slice(0, 19).replace('T', ' ');
  sql(`INSERT INTO Trafegos (id,placa,placa_saida,dataEntrada,dataSaida,identificador_placa_saida,destino,client_id,portaria_entrada_id,portaria_saida_id,createdAt,updatedAt)
   VALUES (1998,'DEM1A11','DEM1A11','${minutosAtras(125)}','${minutosAtras(5)}','an-1998','cruzar',1,1,1,NOW(),NOW())`);
  // a saída foi há 5 minutos: adianta o relógio do job para ela passar da margem de consolidação
  const x = incrementalEm(20);
  const novo = sql("SELECT trafego_id, score_duracao >= 60, status FROM Anomalias WHERE client_id=1 AND chave_veiculo='DEM1A11'");
  ok(x.primeira_execucao === false && x.alertas.novos === 1 && novo === '1998\t1\tABERTA', 'sob demanda: a saída de um veículo com permanência anormal gera o alerta dele', { x, novo });
  ok(sql("SELECT COUNT(*) FROM Anomalias WHERE client_id=1") === '2', 'sob demanda: só a placa que passou é avaliada', sql('SELECT chave_veiculo, score FROM Anomalias'));

  // green list: a mesma saída, reavaliada com a placa na green list, não gera alerta
  sql("DELETE FROM Anomalias WHERE chave_veiculo='DEM1A11'");
  sql("INSERT INTO WhiteList (id,placa,nome,client_id,user_id,createdAt,updatedAt) SELECT 990,'DEM1A11','Morador',1,id,NOW(),NOW() FROM Users WHERE email='adm@bosque'");
  r = job(`--modo=retroativo --cliente=1 --de=${diaLocal(-1)} --ate=${diaLocal(2)}`);
  ok(r[0].resultado.avaliacao.green_list > 0 && sql("SELECT COUNT(*) FROM Anomalias WHERE chave_veiculo='DEM1A11'") === '0', 'green list: placa da green list não é avaliada nem gera alerta', r);
  sql('DELETE FROM WhiteList WHERE id=990');
  r = job(`--modo=retroativo --cliente=1 --de=${diaLocal(-1)} --ate=${diaLocal(2)}`);
  // pode ser mais de um alerta quando a viagem de teste cruza a meia-noite (um por dia)
  ok(Number(sql("SELECT COUNT(*) FROM Anomalias WHERE chave_veiculo='DEM1A11'")) >= 1, 'green list: fora da lista, a placa volta a ser avaliada', r);
}

sql(`DELETE FROM Anomalia_revisoes; DELETE FROM Anomalias; DELETE FROM Anomalia_estados; DELETE FROM Anomalia_referencias; DELETE FROM Anomalia_execucoes;
DELETE FROM Trafegos WHERE id BETWEEN 1000 AND 1999; DELETE FROM Users WHERE email IN ('adm@bosque','adm@outro');`);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(falhas ? 1 : 0);
