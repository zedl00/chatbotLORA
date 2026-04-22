// Ruta: /src/main.ts
// ═══════════════════════════════════════════════════════════════
// MODIFICADO en RBAC sprint: registrar directiva global v-can
// ═══════════════════════════════════════════════════════════════
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { vCan } from './directives/can'
import './styles/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Directiva global para control de permisos en plantillas.
// Uso: <button v-can="'conversations.assign'">Asignar</button>
app.directive('can', vCan)

app.mount('#app')
