import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import App from './App.vue'
import router from './router'
import './style.css'
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'
import 'mapbox-gl/dist/mapbox-gl.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: false // Force clean light theme
    }
  }
})

app.mount('#app')
