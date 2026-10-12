// Testes de integração das abas de tráfego e da conciliação de saídas não identificadas.
//
// Requer um MySQL DESCARTÁVEL (os dados são apagados) com todas as migrações aplicadas e o backend
// apontando para ele. Não usa câmeras: os registros que elas gerariam são inseridos direto no banco.
//
//   1. MySQL:   docker run -d --name digicam-teste-mysql -e MYSQL_ROOT_PASSWORD=teste123 \
//                 -e MYSQL_DATABASE=digicam_teste -p 3307:3306 mysql:8.0
//   2. Migrar:  npx sequelize-cli db:migrate --url mysql://root:teste123@localhost:3307/digicam_teste
//   3. Backend: DATABASE_HOST=localhost ... (porta 3307) node server.js
//   4. Antes de cada execução: mysql --default-character-set=utf8mb4 ... digicam_teste < tests/integracao/dados.sql
//   5. npm run test:integracao   (Node 18+ no host: usa fetch nativo)
//
// Variáveis: API_URL (padrão http://localhost:4000/digicam), MYSQL_CONTAINER (padrão digicam-teste-mysql),
// BACKEND_CONTAINER (padrão: não verifica arquivos de imagem), ADMIN_EMAIL/ADMIN_PASSWORD.
import { execSync } from 'node:child_process';

const BASE = process.env.API_URL || 'http://localhost:4000/digicam';
const MYSQL_CONTAINER = process.env.MYSQL_CONTAINER || 'digicam-teste-mysql';
const BACKEND_CONTAINER = process.env.BACKEND_CONTAINER;
let falhas = 0;
const ok = (cond, msg, extra) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`);
  if (!cond) falhas++;
};
const sql = (q) =>
  execSync(`docker exec -i ${MYSQL_CONTAINER} mysql -N -uroot -pteste123 --default-character-set=utf8mb4 digicam_teste`, {
    input: q,
    stdio: ['pipe', 'pipe', 'ignore'],
  }).toString().trim();

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

const ids = (rows) => rows.map((r) => r.id).sort((a, b) => a - b).join(',');

const admin = api(await login(process.env.ADMIN_EMAIL || 'system@digicam.com.br', process.env.ADMIN_PASSWORD));
const op = api(await login('op@bosque', 'op123'));
const opId = sql("SELECT id FROM Users WHERE email='op@bosque'");

// ---------------- 4.1 listagem por status
let r = await op('GET', '/trafegos/client/1?status=travessia');
ok(ids(r.rows) === '1,8', 'travessia: só cruzar sem saída, oculta green list antiga e outro cliente', r);
r = await op('GET', '/trafegos/client/1?status=servico');
ok(ids(r.rows) === '2,3' && r.total === 2, 'servico: servico + morador sem saída', r);
r = await op('GET', '/trafegos/client/1?status=servico&placa=srv');
ok(ids(r.rows) === '2', 'servico: filtro por placa (case-insensitive)', r);
const umaHoraMeiaAtras = new Date(Date.now() - 90 * 60 * 1000).toISOString();
r = await op('GET', `/trafegos/client/1?status=servico&entradaDe=${encodeURIComponent(umaHoraMeiaAtras)}`);
ok(ids(r.rows) === '3', 'servico: filtro por horário de entrada', r);
r = await op('GET', '/trafegos/client/1?status=servico&page=1&pageSize=1');
ok(r.rows.length === 1 && r.total === 2 && r.pageSize === 1, 'servico: paginação', r);
r = await op('GET', '/trafegos/client/1?status=servico&page=2&pageSize=1');
ok(r.rows.length === 1 && r.rows[0].id === 2, 'servico: segunda página (entradas mais recentes primeiro)', r);
r = await op('GET', '/trafegos/client/1?status=travessia');
ok(r.rows.map((t) => t.id).join(',') === '1,8', 'travessia: entradas mais recentes primeiro', r);
r = await op('GET', '/trafegos/client/1?status=sem_saida');
ok(ids(r.rows) === '1,2,3,8', 'sem_saida: todos os destinos sem saída', r);
r = await op('GET', '/trafegos/client/1?status=saidas');
ok(r.rows.map((t) => t.id).join(',') === '5,9', 'saidas: só do dia, mais recente primeiro', r);
r = await op('GET', '/trafegos/client/1?status=saidas&ordem=saida_asc');
ok(r.rows.map((t) => t.id).join(',') === '9,5', 'saidas: ordenação crescente', r);
r = await op('GET', '/trafegos/client/1?status=saidas&placa=8888');
ok(ids(r.rows) === '9', 'saidas: busca por placa', r);
r = await op('GET', '/trafegos/client/1?status=invalido');
ok(r.statusCode === 400, 'status inválido é rejeitado pela validação', r);

// ---------------- retrocompatibilidade
r = await op('GET', '/trafegos/client/1');
ok(Array.isArray(r) && ids(r) === '1,2,3,8', 'sem status: retorna array como antes', r);
r = await op('GET', '/trafegos/client/1/registros-com-saida');
ok(Array.isArray(r) && ids(r) === '5,9', '4.2 registros-com-saida: só do dia', r);
r = await op('GET', '/trafegos/client/2?status=travessia');
ok(r.total === 0, 'operador não vê tráfegos de outro cliente', r);

// ---------------- 4.3 listagem de saídas não identificadas
r = await op('GET', '/saidasNaoIdentificadas/client/1');
ok(ids(r.rows) === '10,11,12' && r.rows[0].Camera, 'pendentes do cliente, com câmera; legado arquivado fica fora', r);
r = await admin('GET', '/saidasNaoIdentificadas/client/1?status=arquivada');
ok(r.rows.length === 1 && r.rows[0].motivo_arquivamento === 'Registro anterior à implantação da conciliação manual', 'D2: legado arquivado pela migração', r);
r = await op('GET', '/saidasNaoIdentificadas/client/2');
ok(r.total === 0 && r.rows.length === 0, 'operador não lista saídas de outro cliente', r);

// ---------------- 4.4 associação
r = await op('POST', '/saidasNaoIdentificadas/12/associar/1');
ok(r.status === 'ERROR' && /anterior/.test(r.message), 'associar: saída anterior à entrada é recusada', r);
r = await op('POST', '/saidasNaoIdentificadas/10/associar/7');
ok(r.status === 'ERROR', 'associar: entrada de outro cliente é recusada', r);
r = await op('POST', '/saidasNaoIdentificadas/10/associar/5');
ok(r.status === 'ERROR' && /já possui saída/.test(r.message), 'associar: entrada que já tem saída é recusada', r);
r = await op('POST', '/saidasNaoIdentificadas/13/associar/7');
ok(r.status === 'ERROR' && /não permitida/.test(r.message), 'associar: operador não resolve saída de outro cliente', r);

// concorrência: duas associações simultâneas da mesma saída
const [a, b] = await Promise.all([op('POST', '/saidasNaoIdentificadas/10/associar/1'), op('POST', '/saidasNaoIdentificadas/10/associar/8')]);
const vencedores = [a, b].filter((x) => x.status === 'OK');
ok(vencedores.length === 1, 'concorrência: só uma associação vence', [a, b]);
const trafegoVencedor = vencedores[0] && vencedores[0].trafego.id;
const linha = sql(`SELECT dataSaida = (SELECT data FROM Saidas_nao_identificadas WHERE id=10), placa_saida, identificador_placa_saida, portaria_saida_id, saida_automatica, user_reg_saida, imagem_saida, imagem_saida_thumb FROM Trafegos WHERE id=${trafegoVencedor}`);
ok(linha === `1\tABC1D28\ts-10\t1\t0\t${opId}\t/s/10.jpg\t/s/10_thumb.jpg`, 'associação grava saída igual ao casamento automático (horário da câmera, placa, portaria, imagens)', linha);
const saida10 = sql('SELECT status, trafego_id, user_resolucao, resolvido_em IS NOT NULL FROM Saidas_nao_identificadas WHERE id=10');
ok(saida10 === `associada\t${trafegoVencedor}\t${opId}\t1`, 'saída marcada como associada com auditoria', saida10);
r = await op('POST', `/saidasNaoIdentificadas/10/associar/${trafegoVencedor === 1 ? 8 : 1}`);
ok(r.status === 'ERROR' && /resolvida/.test(r.message), 'associar: saída já resolvida é recusada', r);
r = await op('GET', '/trafegos/client/1?status=saidas');
ok(r.rows.some((t) => t.id === trafegoVencedor), 'tráfego associado aparece no histórico do dia', r);

// ---------------- arquivamento
r = await op('POST', '/saidasNaoIdentificadas/11/arquivar', { motivo: 'Veículo de entrega sem registro' });
ok(r.status === 'OK', 'arquivar saída pendente', r);
r = await op('POST', '/saidasNaoIdentificadas/11/arquivar', {});
ok(r.status === 'ERROR', 'arquivar de novo é recusado', r);
const saida11 = sql('SELECT status, motivo_arquivamento, trafego_id IS NULL, user_resolucao FROM Saidas_nao_identificadas WHERE id=11');
ok(saida11 === `arquivada\tVeículo de entrega sem registro\t1\t${opId}`, 'arquivada sem gerar tráfego', saida11);
const totalTrafegos = sql('SELECT COUNT(*) FROM Trafegos');
ok(totalTrafegos === '9', 'nenhum tráfego novo criado', totalTrafegos);
r = await op('GET', '/saidasNaoIdentificadas/client/1');
ok(ids(r.rows) === '12', 'fila só com a pendente restante', r);

// ---------------- Descartar identificação (alimenta a fila só em câmeras de saída)
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
sql(`INSERT INTO LogIdentificacao (id,camera_id,placa,sentido,data,imagem_carro,imagem_placa,identificador_placa,createdAt,updatedAt) VALUES
 (100,2,'DSC1A11','forward',UTC_TIMESTAMP(),FROM_BASE64('${png}'),FROM_BASE64('${png}'),'li-100',NOW(),NOW()),
 (101,1,'ENT2B22','forward',UTC_TIMESTAMP(),FROM_BASE64('${png}'),NULL,'li-101',NOW(),NOW())`);
await op('DELETE', '/logIdentificacao/100');
await op('DELETE', '/logIdentificacao/101');
const fila = sql("SELECT placa, status, client_id, imagem_carro IS NOT NULL, imagem_carro_thumb IS NOT NULL, imagem_placa IS NOT NULL FROM Saidas_nao_identificadas WHERE identificador_placa IN ('li-100','li-101')");
ok(fila === 'DSC1A11\tpendente\t1\t1\t1\t1', 'D1: descarte em câmera de saída entra na fila com imagens; câmera de entrada não', fila);
const caminho = sql("SELECT imagem_carro FROM Saidas_nao_identificadas WHERE identificador_placa='li-100'");
if (BACKEND_CONTAINER) {
  const existe = execSync(`docker exec ${BACKEND_CONTAINER} sh -c 'ls /digicam-fotos${caminho} /digicam-fotos${caminho.replace('.jpg', '_thumb.jpg')} >/dev/null && echo sim'`).toString().trim();
  ok(existe === 'sim', 'imagens da saída gravadas em disco', caminho);
}

// identificação cuja saída já foi registrada em uma entrada não é "saída sem entrada"
sql(`INSERT INTO LogIdentificacao (id,camera_id,placa,sentido,data,imagem_carro,imagem_placa,identificador_placa,createdAt,updatedAt) VALUES
 (102,2,'OUT9999','forward',UTC_TIMESTAMP(),NULL,NULL,'li-102',NOW(),NOW())`);
sql("UPDATE Trafegos SET identificador_placa_saida='li-102' WHERE id=5");
await op('DELETE', '/logIdentificacao/102');
const jaRegistrada = sql("SELECT COUNT(*) FROM Saidas_nao_identificadas WHERE identificador_placa='li-102'");
ok(jaRegistrada === '0', 'descarte de identificação com saída já registrada não entra na fila', jaRegistrada);
ok(sql('SELECT COUNT(*) FROM LogIdentificacao WHERE id=102') === '0', 'e a identificação é removida mesmo assim');

// ---------------- saídas de veículos da green list: aparecem marcadas por 3 minutos e depois saem da fila
sql(`INSERT INTO WhiteList (id,placa,nome,client_id,user_id,createdAt,updatedAt) VALUES (900,'GRN1A11','Morador Green',1,${opId},NOW(),NOW())`);
sql(`INSERT INTO Saidas_nao_identificadas (id,identificador_placa,placa,data,camera_id,client_id,status,createdAt,updatedAt) VALUES
 (20,'s-20','GRN1A11',UTC_TIMESTAMP(),2,1,'pendente',UTC_TIMESTAMP(),UTC_TIMESTAMP()),
 (21,'s-21','GRN1A11',UTC_TIMESTAMP()-INTERVAL 10 MINUTE,2,1,'pendente',UTC_TIMESTAMP()-INTERVAL 10 MINUTE,UTC_TIMESTAMP()-INTERVAL 10 MINUTE)`);
r = await op('GET', '/saidasNaoIdentificadas/client/1');
const verde = r.rows.find((s) => s.id === 20);
ok(verde && verde.in_whitelist === true && verde.whitelist_nome === 'Morador Green', 'green list: saída recente aparece marcada', r);
ok(!r.rows.find((s) => s.id === 21), 'green list: saída com mais de 3 minutos na fila fica oculta', r);
ok(r.rows.filter((s) => s.id !== 20).every((s) => s.in_whitelist === false), 'demais saídas não são marcadas como green list', r);
ok(r.total === r.rows.length, 'total considera só as saídas exibidas', r);
sql('DELETE FROM Saidas_nao_identificadas WHERE id IN (20,21)');
sql('DELETE FROM WhiteList WHERE id=900');

// ---------------- leitura no sentido contrário ao propósito da câmera é ignorada
sql("UPDATE Cameras SET posicionamento='F' WHERE id=2");
const leitura = (placa, sentido) => ({ placa, sentido, data: new Date().toISOString(), camera_id: 2, picname: 'teste' });
r = await admin('POST', '/logIdentificacao', leitura('REV1A11', 'reverse'));
ok(/ignorada/.test(r.mensagem || ''), 'câmera de saída: leitura no sentido contrário é ignorada', r);
ok(sql("SELECT COUNT(*) FROM LogIdentificacao WHERE placa='REV1A11'") === '0', 'e não gera identificação');
r = await admin('POST', '/logIdentificacao', leitura('FWD1A11', 'forward'));
ok(r.id > 0, 'câmera de saída: leitura no sentido correto é aceita', r);
r = await admin('POST', '/logIdentificacao', leitura('UNK1A11', 'unknown'));
ok(r.id > 0, 'direção desconhecida não é filtrada', r);
sql("UPDATE Cameras SET posicionamento='T' WHERE id=2");
r = await admin('POST', '/logIdentificacao', leitura('TRS1A11', 'forward'));
ok(/ignorada/.test(r.mensagem || ''), 'posicionamento T: a direção contrária passa a ser forward', r);
// câmera de entrada direcionada para fora: quem entra vem como reverse; forward é veículo saindo
sql("UPDATE Cameras SET posicionamento='F' WHERE id=1");
r = await admin('POST', '/logIdentificacao', { ...leitura('ENT9Z99', 'forward'), camera_id: 1 });
ok(/ignorada/.test(r.mensagem || ''), 'câmera de entrada: leitura de veículo saindo é ignorada', r);
r = await admin('POST', '/logIdentificacao', { ...leitura('ENT8Z88', 'reverse'), camera_id: 1 });
ok(r.id > 0, 'câmera de entrada: leitura de veículo entrando é aceita', r);
sql("UPDATE Cameras SET posicionamento=NULL WHERE id=1");
sql("UPDATE Cameras SET posicionamento=NULL WHERE id=2");
r = await admin('POST', '/logIdentificacao', leitura('SEM1A11', 'reverse'));
ok(r.id > 0, 'câmera sem posicionamento não é filtrada', r);
await new Promise((resolve) => setTimeout(resolve, 3000));
sql("DELETE FROM LogIdentificacao WHERE placa IN ('FWD1A11','UNK1A11','SEM1A11','ENT8Z88')");
sql("DELETE FROM Trafegos WHERE placa='ENT8Z88'");
sql("DELETE FROM Saidas_nao_identificadas WHERE placa IN ('FWD1A11','UNK1A11','SEM1A11')");

// ---------------- operações em lote para registros com mais de 2 horas (somente administradores)
sql(`INSERT INTO Trafegos (id,placa,dataEntrada,dataSaida,destino,client_id,portaria_entrada_id,in_whitelist,createdAt,updatedAt) VALUES
 (50,'ANT2H01',UTC_TIMESTAMP()-INTERVAL 3 HOUR,NULL,'cruzar',1,1,NULL,NOW(),NOW()),
 (51,'ANT2H02',UTC_TIMESTAMP()-INTERVAL 3 HOUR,NULL,'cruzar',1,1,1,NOW(),NOW()),
 (52,'ANT2H03',UTC_TIMESTAMP()-INTERVAL 3 HOUR,NULL,'servico',1,1,NULL,NOW(),NOW()),
 (53,'ANT2H04',UTC_TIMESTAMP()-INTERVAL 3 HOUR,NULL,'cruzar',2,2,NULL,NOW(),NOW())`);
sql(`INSERT INTO Saidas_nao_identificadas (id,identificador_placa,placa,data,camera_id,client_id,status,createdAt,updatedAt) VALUES
 (30,'s-30','SAI2H01',UTC_TIMESTAMP()-INTERVAL 3 HOUR,2,1,'pendente',UTC_TIMESTAMP(),UTC_TIMESTAMP()),
 (31,'s-31','SAI2H02',UTC_TIMESTAMP()-INTERVAL 10 MINUTE,2,1,'pendente',UTC_TIMESTAMP(),UTC_TIMESTAMP()),
 (32,'s-32','SAI2H03',UTC_TIMESTAMP()-INTERVAL 3 HOUR,3,2,'pendente',UTC_TIMESTAMP(),UTC_TIMESTAMP())`);
r = await op('POST', '/trafegos/client/1/saidaManualAntigas', {});
ok(r.status === 'ERROR' && /administradores/.test(r.message), 'saída em lote: operador comum não pode', r);
r = await op('POST', '/saidasNaoIdentificadas/client/1/arquivarAntigas', {});
ok(r.status === 'ERROR' && /administradores/.test(r.message), 'arquivamento em lote: operador comum não pode', r);
ok(sql('SELECT COUNT(*) FROM Trafegos WHERE id IN (50,51,52,53) AND dataSaida IS NOT NULL') === '0', 'e nada é alterado na tentativa do operador');
r = await admin('POST', '/trafegos/client/1/saidaManualAntigas', {});
ok(r.status === 'OK' && r.quantidade === 1, 'saída em lote: só a entrada cruzar com mais de 2 horas do cliente', r);
const lote = sql('SELECT id, dataSaida IS NOT NULL, IFNULL(saida_automatica,-1) FROM Trafegos WHERE id IN (50,51,52,53) ORDER BY id');
ok(lote === '50\t1\t0\n51\t0\t-1\n52\t0\t-1\n53\t0\t-1', 'green list, serviço e outro cliente não são tocados', lote);
const recentes = sql("SELECT COUNT(*) FROM Trafegos WHERE dataEntrada > UTC_TIMESTAMP() - INTERVAL 2 HOUR AND user_reg_saida IS NOT NULL AND dataSaida > UTC_TIMESTAMP() - INTERVAL 5 SECOND");
ok(recentes === '0', 'entradas com menos de 2 horas não recebem saída em lote', recentes);
r = await admin('POST', '/saidasNaoIdentificadas/client/1/arquivarAntigas', {});
ok(r.status === 'OK' && r.quantidade === 1, 'arquivamento em lote: só a saída pendente com mais de 2 horas do cliente', r);
const arq = sql('SELECT id, status FROM Saidas_nao_identificadas WHERE id IN (30,31,32) ORDER BY id');
ok(arq === '30\tarquivada\n31\tpendente\n32\tpendente', 'saída recente e de outro cliente continuam pendentes', arq);
ok(/lote/.test(sql('SELECT motivo_arquivamento FROM Saidas_nao_identificadas WHERE id=30')), 'motivo do arquivamento em lote é registrado');
sql('DELETE FROM Trafegos WHERE id IN (50,51,52,53)');
sql('DELETE FROM Saidas_nao_identificadas WHERE id IN (30,31,32)');

// ---------------- linha do tempo do dia
r = await op('GET', '/trafegos/client/1/linha-do-tempo');
ok(/^\d{4}-\d{2}-\d{2}$/.test(r.dia) && Array.isArray(r.trafegos) && Array.isArray(r.saidasSemEntrada), 'linha do tempo: formato da resposta', r);
ok(!r.trafegos.find((t) => t.id === 6 || t.id === 7), 'linha do tempo: fora o tráfego de dias anteriores e o de outro cliente', r.trafegos.map((t) => t.id));
ok(r.trafegos.length > 0 && r.trafegos.every((t) => t.dataEntrada), 'linha do tempo: traz os tráfegos do dia', r.trafegos.length);
ok(r.saidasSemEntrada.every((s) => s.status !== 'associada'), 'linha do tempo: saídas associadas não aparecem como saída sem entrada', r.saidasSemEntrada);
r = await op('GET', '/trafegos/client/1/linha-do-tempo?dia=2020-01-01');
ok(r.dia === '2020-01-01' && r.trafegos.length === 0 && r.saidasSemEntrada.length === 0, 'linha do tempo: dia sem movimento vem vazio', r);
r = await op('GET', '/trafegos/client/2/linha-do-tempo');
ok(r.trafegos.length === 0 && r.saidasSemEntrada.length === 0, 'linha do tempo: operador não vê outro cliente', r);

// ---------------- saída manual (rota existente) continua funcionando
r = await op('POST', '/trafegos/saidaManual/2/1', {});
r = await op('GET', '/trafegos/client/1?status=servico');
ok(ids(r.rows) === '3', 'saída manual remove da Aba 2', r);
r = await op('GET', '/trafegos/client/1?status=saidas');
ok(r.rows[0].id === 2, 'e aparece no topo do histórico', r);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(falhas ? 1 : 0);
