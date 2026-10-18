import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/assets/styles.css'
import App from '@/App.vue'
import { router } from '@/router'
import { useAuthStore } from '@/store/auth'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
window.addEventListener('auth:expired', () => useAuthStore().clearSession())
app.mount('#app')
