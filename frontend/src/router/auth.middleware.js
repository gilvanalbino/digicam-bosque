import useLogin from '../composables/useLogin';
import useClientes from '../composables/useClientes';
import usePortarias from '../composables/usePortarias';
import useCameras from '../composables/useCameras';

// após recarregar a página a sessão é recuperada, mas os dados que o login carrega (clientes, portarias e
// câmeras) se perdem; são recarregados aqui antes de abrir a primeira tela
const carregarDadosIniciais = async () => {
  await useClientes.actions.carregarClientes();
  const cliente = useClientes.state.clientes.selecionado;
  if (cliente) {
    await usePortarias.actions.carregarPortarias(cliente.id);
    await useCameras.actions.carregarCameras(cliente.id);
  }
};

export const authGuard = () => {
  return async (to, from, next) => {
    // páginas publicas
    const publicPages = ['/login']; //, '/register', '/home', '/forgotpassword'];
    const authRequired = !publicPages.includes(to.path);

    // se acessando página publica segue
    if (!authRequired) {
      return next();
    }

    // se não estiver logado, direciona para tela de login
    if (!useLogin.state.auth.logged) {
      return next('/login');
    }

    if (useLogin.state.auth.restaurada) {
      try {
        await carregarDadosIniciais();
        useLogin.actions.confirmarRestauracao();
      } catch (error) {
        // sessão guardada não vale mais (token recusado pelo backend): volta para o login
        console.log('Sessão expirada ou inválida', error);
        useLogin.actions.logout();
        return next('/login');
      }
    }

    return next();
  };
};
