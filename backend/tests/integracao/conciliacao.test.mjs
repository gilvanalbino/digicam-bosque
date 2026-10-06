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
ok(r.rows.length === 1 && r.rows[0].id === 3, 'servico: segunda página (ordem por entrada)', r);
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

// ---------------- saída manual (rota existente) continua funcionando
r = await op('POST', '/trafegos/saidaManual/2/1', {});
r = await op('GET', '/trafegos/client/1?status=servico');
ok(ids(r.rows) === '3', 'saída manual remove da Aba 2', r);
r = await op('GET', '/trafegos/client/1?status=saidas');
ok(r.rows[0].id === 2, 'e aparece no topo do histórico', r);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(falhas ? 1 : 0);
