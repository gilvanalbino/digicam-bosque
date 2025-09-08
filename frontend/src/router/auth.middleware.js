import useLogin from '../composables/useLogin';

export const authGuard = () => {
  return (to, from, next) => {
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
    } else {
      return next();
    }
  };
};
