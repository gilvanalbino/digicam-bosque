// Avisos em tempo real do backend (Server-Sent Events): quando um tráfego ou uma saída sem entrada muda, as listas
// recarregam na hora. Com a conexão aberta, a consulta periódica das listas vira só reserva (a cada 30 s); sem ela
// (proxy que não repassa SSE, backend reiniciando), as listas voltam a ser consultadas a cada 5 s.
import useLogin from './useLogin';
import useClientes from './useClientes';

const BASE = import.meta.env.VITE_APP_BACKEND || '/digicam';
const ouvintes = { trafegos: new Set(), saidas: new Set() };
const estado = { conectado: false };
let fonte = null;
let chaveAtual = null;

const avisar = (tipo) => {
  for (const fn of ouvintes[tipo] || []) {
    try {
      fn();
    } catch (e) {
      console.log('Erro tratando aviso em tempo real', e);
    }
  }
};

const fechar = () => {
  if (fonte) fonte.close();
  fonte = null;
  chaveAtual = null;
  estado.conectado = false;
};

const conectar = () => {
  // useClientes importa useTrafegos, que importa este módulo: no carregamento, um deles ainda pode estar indefinido
  const token = useLogin && useLogin.state && useLogin.state.auth && useLogin.state.auth.token;
  const cliente = useClientes && useClientes.state && useClientes.state.clientes && useClientes.state.clientes.selecionado;
  if (!token || !cliente || typeof EventSource === 'undefined') {
    fechar();
    return;
  }
  const chave = `${cliente.id}|${token}`;
  if (fonte && chave === chaveAtual && fonte.readyState !== 2) return; // 2 = CLOSED
  fechar();
  chaveAtual = chave;
  fonte = new EventSource(`${BASE}/eventos/client/${cliente.id}?token=${encodeURIComponent(token)}`);
  fonte.addEventListener('conectado', () => {
    estado.conectado = true;
  });
  fonte.addEventListener('trafegos', () => avisar('trafegos'));
  fonte.addEventListener('saidas', () => avisar('saidas'));
  fonte.onerror = () => {
    // o navegador tenta reconectar sozinho; enquanto isso, as listas voltam à consulta de 5 s
    estado.conectado = false;
  };
};

// confere a cada 5 s se a conexão está aberta para o cliente selecionado (troca de cliente, login, queda)
setInterval(conectar, 5000);
// primeira conexão depois que todos os módulos terminarem de carregar
setTimeout(conectar, 0);

export default {
  estado,
  /** Registra uma função chamada quando chega um aviso do tipo ("trafegos" ou "saidas"). */
  aoMudar(tipo, fn) {
    ouvintes[tipo].add(fn);
    return () => ouvintes[tipo].delete(fn);
  },
};
