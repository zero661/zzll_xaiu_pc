import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import Vant from 'vant'
import 'vant/lib/index.css'
import { setToastDefaultOptions } from 'vant'
import { initSentry } from './sentry.config'
import '@tinymomentum/liquid-glass-vue/dist/liquid-glass-vue.css'

const app = createApp(App)
setToastDefaultOptions({ duration: 3000 })
setToastDefaultOptions('loading', { duration: 0 })

// 初始化 Sentry
const Sentry = initSentry(app, router)
const isProd = process.env.NODE_ENV === 'production'
app.config.errorHandler = (err, instance, info) => {
  if (err === 'cancel' || err?.message === 'cancel' || err?.toString?.() === 'cancel') {
    console.log('用户取消了操作')
    return
  }
  console.error('Vue error:', err, info)
  if (isProd) {
    Sentry.captureException(err)
  }
}
// 全局 Promise 拒绝处理
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  if (reason === 'cancel' || reason?.message === 'cancel' || reason?.toString?.() === 'cancel') {
    event.preventDefault()
    console.log('用户取消了操作（Promise）')
    return
  }
  console.warn('Unhandled rejection:', reason)
  if (isProd) {
    Sentry.captureException(reason)
  }
})

app.use(router)
app.use(store)
app.use(Vant)
app.mount('#app')