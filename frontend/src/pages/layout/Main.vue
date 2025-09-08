<!-- This example requires Tailwind CSS v2.0+ -->
<template>
  <!--
    This example requires updating your template:

    ```
    <html class="h-full bg-gray-100">
    <body class="h-full">
    ```
  -->
  <!-- eslint-disable vue/no-use-v-if-with-v-for,vue/no-confusing-v-for-v-if -->
  <div>
    <TransitionRoot as="template" :show="sidebarOpen">
      <Dialog as="div" class="fixed inset-0 flex z-40 lg:hidden" @close="sidebarOpen = false">
        <TransitionChild as="template" enter="transition-opacity ease-linear duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="transition-opacity ease-linear duration-300" leave-from="opacity-100" leave-to="opacity-0">
          <DialogOverlay class="fixed inset-0 bg-gray-600 bg-opacity-75" />
        </TransitionChild>
        <TransitionChild as="template" enter="transition ease-in-out duration-300 transform" enter-from="-translate-x-full" enter-to="translate-x-0" leave="transition ease-in-out duration-300 transform" leave-from="translate-x-0" leave-to="-translate-x-full">
          <div class="relative flex-1 flex flex-col max-w-xs w-full bg-gray-800">
            <TransitionChild as="template" enter="ease-in-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in-out duration-300" leave-from="opacity-100" leave-to="opacity-0">
              <div class="absolute top-0 right-0 -mr-12 pt-2">
                <button type="button" class="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" @click="sidebarOpen = false">
                  <span class="sr-only">Fechar Menu</span>
                  <XIcon class="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>
            </TransitionChild>
            <div class="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div class="flex-shrink-0 flex items-center px-4">
                <h1 class="text-white text-2xl font-extrabold">D I G I C A M</h1>
                <h2>{{ user.name }}</h2>
              </div>
              <hr class="mt-5"/>
              <div class="ml-4 mr-4 mt-2">

                <!-- clientes -->
                <Listbox as="div" v-if="clienteSelecionado">
                  <ListboxLabel class="block text-sm font-medium text-white">
                    Clientes
                  </ListboxLabel>
                  <div class="mt-1 relative">
                    <ListboxButton class="relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                      <div class="flex items-center">
                        <span :aria-label="clienteSelecionado.active ? 'Online' : 'Offline'" :class="[clienteSelecionado.active ? 'bg-green-400' : 'bg-gray-200', 'flex-shrink-0 inline-block h-2 w-2 rounded-full']" />
                        <span class="ml-3 block truncate">{{ clienteSelecionado.name }}</span>
                      </div>
                      <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <SelectorIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </span>
                    </ListboxButton>

                    <transition leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
                      <ListboxOptions class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                        <ListboxOption as="template" v-for="cliente in clientes" :key="cliente.id" :value="cliente" v-slot="{ active, selected }" @click="selecionarCliente(cliente)" >
                          <li :class="[active ? 'text-white bg-indigo-600' : 'text-gray-900', 'cursor-default select-none relative py-2 pl-3 pr-9']">
                            <div class="flex items-center">
                              <span :class="[cliente.active ? 'bg-green-400' : 'bg-gray-200', 'flex-shrink-0 inline-block h-2 w-2 rounded-full']" aria-hidden="true" />
                              <span :class="[selected ? 'font-semibold' : 'font-normal', 'ml-3 block truncate']">
                                {{ cliente.name }}
                                <span class="sr-only"> is {{ cliente.active ? 'online' : 'offline' }}</span>
                              </span>
                            </div>

                            <span v-if="selected" :class="[active ? 'text-white' : 'text-indigo-600', 'absolute inset-y-0 right-0 flex items-center pr-4']">
                              <CheckIcon class="h-5 w-5" aria-hidden="true" />
                            </span>
                          </li>
                        </ListboxOption>
                      </ListboxOptions>
                    </transition>
                  </div>
                </Listbox>
              </div>

              <div class="ml-4 mr-4 mt-2">

                <!-- Portarias -->
                <Listbox as="div" v-if="portariaSelecionada">
                  <ListboxLabel class="block text-sm font-medium text-white">
                    Portarias
                  </ListboxLabel>
                  <div class="mt-1 relative">
                    <ListboxButton class="relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                      <div class="flex items-center">
                        <span class="flex-shrink-0 inline-block h-2 w-2 rounded-full" />
                        <span class="ml-3 block truncate">{{ portariaSelecionada.nome }}</span>
                      </div>
                      <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <SelectorIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </span>
                    </ListboxButton>

                    <transition leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
                      <ListboxOptions class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                        <ListboxOption as="template" v-for="portaria in portarias" :key="portaria" :value="portaria" v-slot="{ active, selected }" >
                          <li :class="[active ? 'text-white bg-indigo-600' : 'text-gray-900', 'cursor-default select-none relative py-2 pl-3 pr-9']" @click="selecionarPortaria(portaria)" >
                            <div class="flex items-center">
                              <span class="'flex-shrink-0 inline-block h-2 w-2 rounded-full']" aria-hidden="true" />
                              <span :class="[selected ? 'font-semibold' : 'font-normal', 'ml-3 block truncate']">
                                {{ portaria.nome }}
                              </span>
                            </div>

                            <span v-if="selected" :class="[active ? 'text-white' : 'text-indigo-600', 'absolute inset-y-0 right-0 flex items-center pr-4']">
                              <CheckIcon class="h-5 w-5" aria-hidden="true" />
                            </span>
                          </li>
                        </ListboxOption>
                      </ListboxOptions>
                    </transition>
                  </div>
                </Listbox>
                <div v-else>Não existe portarias cadastradas</div>
              </div>

              <hr class="mt-5"/>

              <nav class="mt-5 px-2 space-y-1">
                <div v-for="item in navigation" :key="item.name" >
                <a v-if="item.visible" href='#'  @click="item.action" :class="[item.current ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white', 'group flex items-center px-2 py-2 text-base font-medium rounded-md']">
                  <component :is="item.icon" :class="[item.current ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-300', 'mr-4 flex-shrink-0 h-6 w-6']" aria-hidden="true" />
                  {{ item.name }}
                </a>
                </div>
              </nav>
            </div>
          </div>
        </TransitionChild>
        <div class="flex-shrink-0 w-14">
          <!-- Force sidebar to shrink to fit close icon -->
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Static sidebar for desktop -->
    <div class="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
      <!-- Sidebar component, swap this element with another sidebar if you like -->
      <div class="flex-1 flex flex-col min-h-0 bg-gray-800">
        <div class="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div class="flex items-center flex-shrink-0 px-4">
            <div>
              <h1 class="text-white text-2xl font-extrabold">D I G I C A M</h1>
              <h2 class="text-white block">{{ user.name }}</h2>
              <h2 class="text-white block">{{ user.email }}</h2>
            </div>
          </div>
          <hr class="mt-5"/>
          <div class="ml-4 mr-4 mt-2">

            <!-- clientes -->
            <Listbox as="div" v-if="clienteSelecionado && user.admin">
              <ListboxLabel class="block text-sm font-medium text-white">
                Clientes
              </ListboxLabel>
              <div class="mt-1 relative">
                <ListboxButton class="relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <div class="flex items-center">
                    <span :aria-label="clienteSelecionado.active ? 'Online' : 'Offline'" :class="[clienteSelecionado.active ? 'bg-green-400' : 'bg-gray-200', 'flex-shrink-0 inline-block h-2 w-2 rounded-full']" />
                    <span class="ml-3 block truncate">{{ clienteSelecionado.name }}</span>
                  </div>
                  <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <SelectorIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </span>
                </ListboxButton>

                <transition leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
                  <ListboxOptions class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    <ListboxOption as="template" v-for="cliente in clientes" :key="cliente.id" :value="cliente" v-slot="{ active, selected }" @click="selecionarCliente(cliente)" >
                      <li :class="[active ? 'text-white bg-indigo-600' : 'text-gray-900', 'cursor-default select-none relative py-2 pl-3 pr-9']">
                        <div class="flex items-center">
                          <span :class="[cliente.active ? 'bg-green-400' : 'bg-gray-200', 'flex-shrink-0 inline-block h-2 w-2 rounded-full']" aria-hidden="true" />
                          <span :class="[selected ? 'font-semibold' : 'font-normal', 'ml-3 block truncate']">
                            {{ cliente.name }}
                            <span class="sr-only"> is {{ cliente.active ? 'online' : 'offline' }}</span>
                          </span>
                        </div>

                        <span v-if="selected" :class="[active ? 'text-white' : 'text-indigo-600', 'absolute inset-y-0 right-0 flex items-center pr-4']">
                          <CheckIcon class="h-5 w-5" aria-hidden="true" />
                        </span>
                      </li>
                    </ListboxOption>
                  </ListboxOptions>
                </transition>
              </div>
            </Listbox>
          </div>

          <div class="ml-4 mr-4 mt-2">

            <!-- Portarias -->
            <Listbox as="div" v-if="portariaSelecionada">
              <ListboxLabel class="block text-sm font-medium text-white">
                Portarias
              </ListboxLabel>
              <div class="mt-1 relative">
                <ListboxButton class="relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <div class="flex items-center">
                    <span class="flex-shrink-0 inline-block h-2 w-2 rounded-full" />
                    <span class="ml-3 block truncate">{{ portariaSelecionada.nome }}</span>
                  </div>
                  <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <SelectorIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </span>
                </ListboxButton>

                <transition leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
                  <ListboxOptions class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    <ListboxOption as="template" v-for="portaria in portarias" :key="portaria" :value="portaria" v-slot="{ active, selected }" >
                      <li :class="[active ? 'text-white bg-indigo-600' : 'text-gray-900', 'cursor-default select-none relative py-2 pl-3 pr-9']" @click="selecionarPortaria(portaria)" >
                        <div class="flex items-center">
                          <span class="'flex-shrink-0 inline-block h-2 w-2 rounded-full']" aria-hidden="true" />
                          <span :class="[selected ? 'font-semibold' : 'font-normal', 'ml-3 block truncate']">
                            {{ portaria.nome }}
                          </span>
                        </div>

                        <span v-if="selected" :class="[active ? 'text-white' : 'text-indigo-600', 'absolute inset-y-0 right-0 flex items-center pr-4']">
                          <CheckIcon class="h-5 w-5" aria-hidden="true" />
                        </span>
                      </li>
                    </ListboxOption>
                  </ListboxOptions>
                </transition>
              </div>
            </Listbox>
            <div class="text-red-300 mt-2" v-else>Não existe portarias cadastradas</div>
          </div>

          <!-- Navigation Menu -->
          <nav class="mt-5 flex-1 px-2 space-y-1">
            <div v-for="item in navigation" :key="item.name" >
              <a v-if="item.visible" href='#'  @click="item.action" :class="[item.current ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white', 'group flex items-center px-2 py-2 text-sm font-medium rounded-md']">
                <component :is="item.icon" :class="[item.current ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-300', 'mr-3 flex-shrink-0 h-6 w-6']" aria-hidden="true" />
                {{ item.name }}
              </a>
            </div>
          </nav>
        </div>
      </div>
    </div>
    <div class="lg:pl-64 flex flex-col flex-1">
      <div class="sticky top-0 z-10 lg:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-100">
        <button type="button" class="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500" @click="sidebarOpen = true">
          <span class="sr-only">Open sidebar</span>
          <MenuIcon class="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
      <main class="flex-1">
        <div class="py-6">
          <div class="flex flex-row max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 class="flex-1 text-2xl font-semibold text-gray-900 mr-5">{{ titulo }}</h1>
            <slot name="buttons"></slot>
          </div>
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <!-- Replace with your content -->
            <!-- <div class="py-4">
              <div class="border-4 border-dashed border-gray-200 rounded-lg h-96" />
            </div> -->
            <slot></slot>
            <!-- /End replace -->
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { Dialog, DialogOverlay, TransitionChild, TransitionRoot, Listbox, ListboxButton, ListboxLabel, ListboxOption, ListboxOptions } from '@headlessui/vue'
import {
  BookOpenIcon,
  VideoCameraIcon,
  UsersIcon,
  UserIcon,
  HomeIcon,
  MenuIcon,
  XIcon,
  LogoutIcon,
  ShieldCheckIcon,
  CheckIcon,
  SelectorIcon,
  DocumentReportIcon,
  SwitchVerticalIcon,
  BanIcon
} from '@heroicons/vue/outline'


import { useRouter } from 'vue-router';
import { useStore } from 'vuex'

import useLogin from '../../composables/useLogin'
import useClientes from '../../composables/useClientes'
import usePortarias from '../../composables/usePortarias'
import useTrafegos from '../../composables/useTrafegos';
import useLogIdentificacao from '../../composables/useLogIdentificacao';
import useCameras from '../../composables/useCameras';

export default {
  components: {
    Dialog,
    DialogOverlay,
    TransitionChild,
    TransitionRoot,
    MenuIcon,
    XIcon,
    Listbox,
    ListboxButton,
    ListboxLabel,
    ListboxOption,
    ListboxOptions,
    CheckIcon,
    SelectorIcon,
  },
  props: ['titulo', 'menu'],
  setup(props) {
    const sidebarOpen = ref(false)

    const router = useRouter();

    const clientes = computed(() => useClientes.state.clientes.lista.filter((c)=>c.active));
    const clienteSelecionado = computed(() => useClientes.state.clientes.selecionado)

    const selecionarCliente = async (cliente) => {
      await useClientes.actions.selecionarCliente(cliente.id)
      await usePortarias.actions.carregarPortarias(cliente.id)
      await useTrafegos.actions.carregarTrafegos(useClientes.state.clientes.selecionado.id)
      await useCameras.actions.carregarCameras(useClientes.state.clientes.selecionado.id)
      await useLogIdentificacao.actions.carregarIdentificacoes(portariaSelecionada.value.id)
      router.replace('/')
    }

    const portarias = computed(() => usePortarias.state.portarias.lista);
    let portariaSelecionada = computed(() => usePortarias.state.portarias.selecionada);

    const selecionarPortaria = async (portaria) => {
      await usePortarias.actions.selecionarPortaria(portaria.id)
      console.log("carregando trafego - evento selecionar portaria")
      await useTrafegos.actions.carregarTrafegos(useClientes.state.clientes.selecionado.id)
      console.log(useTrafegos.state.trafegos)
      await useCameras.actions.carregarCameras(useClientes.state.clientes.selecionado.id)
      await useLogIdentificacao.actions.carregarIdentificacoes(portariaSelecionada.value.id)
    }

    const logout = async () => {
      await useLogin.actions.logout();
      router.replace('/login');
    };

    const user = useLogin.state.auth.user;

    let navigation = [
      { name: 'Tráfego', visible: true, icon: BookOpenIcon, action: ()=>{router.replace('/')} },
      // { name: 'Tráfego/Saídas', visible: true, icon: BookOpenIcon, action: ()=>{router.replace('/trafegos/saidas')} },
      { name: 'Green List', visible: true, icon: SwitchVerticalIcon, action: ()=>{router.replace('/greenList')} },
      { name: 'Red List', visible: true, icon: BanIcon, action: ()=>{router.replace('/redList')} },
      { name: 'Cadastro de Clientes', visible: user.admin, icon: UsersIcon, action: ()=>{router.replace('/clientes')} },
      { name: 'Cadastro de Portarias', visible: user.admin, icon: ShieldCheckIcon, action: ()=>{router.replace('/portarias')}},
      { name: 'Cadastro de Câmeras', visible: user.admin, icon: VideoCameraIcon, action: ()=>{router.replace('/cameras')} },
      { name: 'Cadastro de Usuários', visible: user.admin || user.admin_client, icon: UserIcon, action: ()=>{router.replace('/usuarios')} },
      { name: 'Cadastro de Moradores', visible: user.admin || user.admin_client, icon: HomeIcon, action: ()=>{router.replace('/moradores')} },
      { name: 'Rel. Listagem Trafego', visible: user.admin || user.admin_client, icon: DocumentReportIcon, action: ()=>{router.replace('/relatorios/listagemTrafego')} },
      { name: 'Sair', visible: true, icon: LogoutIcon, action: logout },
    ]

    navigation = navigation.map((item)=>{
      return {...item, current: item.name===props.menu}
    })


    return {
      navigation,
      sidebarOpen,
      clientes,
      clienteSelecionado,
      selecionarCliente,
      portarias,
      portariaSelecionada,
      selecionarPortaria,
      user
    }
  },
}
</script>
