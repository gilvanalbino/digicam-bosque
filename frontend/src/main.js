import { createApp } from 'vue';
import App from './App.vue';
import './index.css';
import router from './router';
import Notifications from 'notiwind';
import Maska from 'maska';
import Datepicker from 'vue3-date-time-picker';
import 'vue3-date-time-picker/dist/main.css';

const app = createApp(App);
app.use(router);
app.use(Notifications);
app.use(Maska);

app.component('Datepicker', Datepicker);

app.mount('#app');
