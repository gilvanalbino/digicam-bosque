import { createRouter, createWebHistory } from 'vue-router';

import Login from '../pages/auth/Login.vue';

import ListClientes from '../pages/clientes/ListClientes.vue';
import FormClientes from '../pages/clientes/FormCliente.vue';

import ListPortarias from '../pages/portarias/ListPortarias.vue';
import FormPortaria from '../pages/portarias/FormPortaria.vue';

import ListCameras from '../pages/cameras/ListCameras.vue';
import FormCamera from '../pages/cameras/FormCamera.vue';

import ListUsuarios from '../pages/usuarios/ListUsuarios.vue';
import FormUsuario from '../pages/usuarios/FormUsuario.vue';

import ListMoradores from '../pages/moradores/ListMoradores.vue';
import FormMorador from '../pages/moradores/FormMorador.vue';

import FormTrafego from '../pages/trafegos/FormTrafego.vue';
import ListSelecaoIdentAuto from '../pages/trafegos/ListSelecaoIdentAuto.vue';
import Dashboard from '../pages/trafegos/Dashboard.vue';
import ListTrafegosComSaida from '../pages/trafegos/ListTrafegosComSaida.vue';

import ListagemTrafegoPorPeriodo from '../pages/relatorios/ListagemTrafegoPorPeriodo.vue';

import ListWhiteList from '../pages/whiteList/ListWhiteList.vue';
import FormWhiteList from '../pages/whiteList/FormWhiteList.vue';

import ListBlackList from '../pages/blackList/ListBlackList.vue';
import FormBlackList from '../pages/blackList/FormBlackList.vue';

import { authGuard } from './auth.middleware';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: Login,
    },
    {
      path: '/clientes',
      component: ListClientes,
    },
    {
      path: '/clientes/novo',
      component: FormClientes,
    },
    {
      path: '/clientes/:id',
      component: FormClientes,
    },
    {
      path: '/portarias',
      component: ListPortarias,
    },
    {
      path: '/portarias/novo',
      component: FormPortaria,
    },
    {
      path: '/portarias/:id',
      component: FormPortaria,
    },
    {
      path: '/cameras',
      component: ListCameras,
    },
    {
      path: '/cameras/novo',
      component: FormCamera,
    },
    {
      path: '/cameras/:id',
      component: FormCamera,
    },
    {
      path: '/usuarios',
      component: ListUsuarios,
    },
    {
      path: '/usuarios/novo',
      component: FormUsuario,
    },
    {
      path: '/usuarios/:id',
      component: FormUsuario,
    },
    {
      path: '/moradores',
      component: ListMoradores,
    },
    {
      path: '/moradores/novo',
      component: FormMorador,
    },
    {
      path: '/moradores/:id',
      component: FormMorador,
    },
    {
      path: '/',
      component: Dashboard,
    },
    {
      path: '/trafegos/novo',
      component: FormTrafego,
    },
    {
      path: '/trafegos/editar/:id',
      component: FormTrafego,
    },
    {
      path: '/trafegos/novo/placaIdentificada/:id',
      component: FormTrafego,
    },
    {
      path: '/trafegos/placasIdentificadas',
      component: ListSelecaoIdentAuto,
    },
    {
      path: '/trafegos/saidas',
      component: ListTrafegosComSaida,
    },
    {
      path: '/relatorios/listagemTrafego',
      component: ListagemTrafegoPorPeriodo,
    },
    {
      path: '/greenList',
      component: ListWhiteList,
    },
    {
      path: '/greenList/novo',
      component: FormWhiteList,
    },
    {
      path: '/greenList/:id',
      component: FormWhiteList,
    },
    {
      path: '/redList',
      component: ListBlackList,
    },
    {
      path: '/redList/novo',
      component: FormBlackList,
    },
    {
      path: '/redList/:id',
      component: FormBlackList,
    },
  ],
});

// adicionando middle de autenticação
router.beforeEach(authGuard());

export default router;
