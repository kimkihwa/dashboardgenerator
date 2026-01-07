import { createApp } from 'vue'
import App from './App.vue'

// 라우터는 현재 단일 페이지라 제거
const app = createApp(App)

app.mount('#app')
