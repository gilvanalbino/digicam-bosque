'use strict';
/**
 * Avisos em tempo real para as telas (SSE): quando um tráfego ou uma saída sem entrada é criado ou alterado, as telas
 * abertas daquele cliente recarregam na hora, em vez de esperar a próxima consulta periódica. Os avisos de um mesmo
 * cliente são agrupados em 300 ms, para uma leitura de placa (que mexe em vários registros) gerar um aviso só.
 */
const { EventEmitter } = require('events');

const emissor = new EventEmitter();
emissor.setMaxListeners(500);

const AGRUPAR_MS = 300;
const pendentes = new Map(); // client_id (ou '*') -> Set de tipos

const avisar = (clientId, tipo) => {
  const chave = clientId || '*';
  if (!pendentes.has(chave)) {
    pendentes.set(chave, new Set());
    setTimeout(() => {
      const tipos = pendentes.get(chave);
      pendentes.delete(chave);
      for (const t of tipos) emissor.emit('aviso', { clientId: clientId || null, tipo: t });
    }, AGRUPAR_MS);
  }
  pendentes.get(chave).add(tipo);
};

/** Assina os avisos de um cliente (e os sem cliente, de alterações em lote). Retorna a função que cancela. */
const assinar = (clientId, aoAvisar) => {
  const ouvinte = (aviso) => {
    if (!aviso.clientId || Number(aviso.clientId) === Number(clientId)) aoAvisar(aviso.tipo);
  };
  emissor.on('aviso', ouvinte);
  return () => emissor.off('aviso', ouvinte);
};

const conexoes = () => emissor.listenerCount('aviso');

/** Ganchos do Sequelize que avisam as telas de qualquer criação, alteração ou exclusão do model. */
const ganchos = (tipo) => ({
  afterCreate: (registro) => avisar(registro.client_id, tipo),
  afterUpdate: (registro) => avisar(registro.client_id, tipo),
  afterDestroy: (registro) => avisar(registro.client_id, tipo),
  // alteração em lote (Model.update): o cliente não é conhecido, avisa todos
  afterBulkUpdate: () => avisar(null, tipo),
  afterBulkCreate: () => avisar(null, tipo),
  afterBulkDestroy: () => avisar(null, tipo),
});

module.exports = { avisar, assinar, conexoes, ganchos };
