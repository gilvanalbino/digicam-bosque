import axios from 'axios';

console.log('Enviroment MODE: ', import.meta.env.MODE);
console.log('Enviroment ENV: ', import.meta.env);

let backendUrl = import.meta.env.VITE_APP_BACKEND;

// if (import.meta.env.PROD) {
//   backendUrl = 'https://digicam.interactsystem.com.br/digicam';
// }

console.log('backendUrl: ', backendUrl);

const api = axios.create({ baseURL: backendUrl });

export { api };
