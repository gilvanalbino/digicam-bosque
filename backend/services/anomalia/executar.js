'use strict';

// Linha de comando do detector de anomalias. Roda em container próprio, com a imagem do backend:
//   node services/anomalia/executar.js --modo=servico                      ciclo contínuo (padrão)
//   node services/anomalia/executar.js --modo=incremental [--cliente=2]
//   node services/anomalia/executar.js --modo=referencias [--cliente=2]
//   node services/anomalia/executar.js --modo=retroativo --cliente=2 --de=2026-09-01 --ate=2026-10-01
// As datas de --de e --ate são dias no fuso do processo (TZ); --ate é exclusivo.
const dados = require('./dados');
const job = require('./job');

const argumentos = {};
for (const argumento of process.argv.slice(2)) {
  const [nome, valor] = argumento.replace(/^--/, '').split('=');
  argumentos[nome] = valor === undefined ? true : valor;
}

const diaLocal = (texto) => {
  const [ano, mes, dia] = texto.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
};

const clientes = async () =>
  argumentos.cliente ? [Number(argumentos.cliente)] : (await dados.listarClientes()).map((cliente) => cliente.id);

const umaVez = async (modo) => {
  for (const clientId of await clientes()) {
    let resultado;
    if (modo === 'retroativo') {
      if (!argumentos.de || !argumentos.ate) throw new Error('Informe --de e --ate (AAAA-MM-DD)');
      resultado = await dados.comTrava(clientId, () => job.executarRetroativo(clientId, diaLocal(argumentos.de), diaLocal(argumentos.ate)));
    } else if (modo === 'referencias') {
      resultado = await dados.comTrava(clientId, () => job.executarReferencias(clientId));
    } else {
      resultado = await dados.comTrava(clientId, () => job.executarIncremental(clientId));
    }
    console.log(JSON.stringify({ anomalias: modo, cliente: clientId, resultado }));
  }
};

const servico = async () => {
  const intervaloMs = Number(process.env.ANOMALIA_INTERVALO_MIN || 5) * 60000;
  console.log(`Detector de anomalias em serviço: um ciclo a cada ${intervaloMs / 60000} min`);
  for (;;) {
    const inicio = Date.now();
    try {
      for (const clientId of await clientes()) {
        try {
          const resultado = await job.executarCiclo(clientId);
          console.log(JSON.stringify({ anomalias: 'ciclo', cliente: clientId, ms: Date.now() - inicio, resultado }));
        } catch (erro) {
          console.error(`Erro no ciclo de anomalias do cliente ${clientId}:`, erro);
        }
      }
    } catch (erro) {
      console.error('Erro no ciclo de anomalias:', erro);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.max(1000, intervaloMs - (Date.now() - inicio))));
  }
};

const modo = argumentos.modo || 'servico';
(modo === 'servico' ? servico() : umaVez(modo))
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
