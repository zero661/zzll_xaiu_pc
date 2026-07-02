import axios from 'axios'
import { showFailToast } from 'vant'
import router from '../router'

// 创建axios实例
const instance = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
instance.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 跳转到登录页面的函数
const redirectToLogin = () => {
  // 清除本地存储
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('zhkt_login_info')
  // 跳转到登录页
  if (router.currentRoute.value.path !== '/login') {
    router.push('/login')
  }
}

// 响应拦截器
instance.interceptors.response.use(
  response => {
    const res = response.data
    // 无论状态码是多少，只要返回了数据就处理
    if (res.success === false) {
      const message = res.message || '请求失败'
      showFailToast({
        message: message,
        duration: 3000
      })
      // 401 或 token 过期，跳转到登录页
      if (message === '无效的token' || message === 'token已过期' || res.code === 401) {
        redirectToLogin()
      }
      return Promise.reject(new Error(message))
    }
    return res
  },
  error => {
    console.error('响应错误:', error)

    // 处理有响应的错误（非200状态码但有返回数据）
    if (error.response) {
      const status = error.response.status
      const data = error.response.data
      let msg = error.response.data.message || `请求失败 (${status})`
      // 401 未授权，跳转到登录页
      if (status === 401) {
        showFailToast({
          message: msg,
          duration: 3000
        })
        redirectToLogin()
        return Promise.reject(new Error(msg))
      }

      // 优先使用后端返回的提示信息
      let message = ''
      if (data && data.message) {
        message = data.message
      } else if (data && data.msg) {
        message = data.msg
      } else if (typeof data === 'string') {
        message = data
      } else {
        // 根据状态码设置默认提示
        switch (status) {
          case 400:
            message = '请求参数错误'
            break
          case 403:
            message = '无权限访问'
            break
          case 404:
            message = '请求的资源不存在'
            break
          case 500:
            message = '服务器错误，请稍后重试'
            break
          default:
            message = `请求失败 (${status})`
        }
      }

      showFailToast({
        message: message,
        duration: 3000
      })

      return Promise.reject(new Error(message))
    }

    // 处理网络错误
    if (error.code === 'ECONNABORTED') {
      showFailToast({
        message: '请求超时，请检查网络',
        duration: 3000
      })
    } else if (error.message === 'Network Error') {
      showFailToast({
        message: '网络连接失败，请检查网络',
        duration: 3000
      })
    } else {
      showFailToast({
        message: error.message || '请求失败',
        duration: 3000
      })
    }

    return Promise.reject(error)
  }
)

// 封装方法
instance.get = function (url, params = {}) {
  return this.request({
    method: 'get',
    url,
    params
  })
}

instance.post = function (url, data = {}) {
  return this.request({
    method: 'post',
    url,
    data
  })
}

instance.put = function (url, data = {}) {
  return this.request({
    method: 'put',
    url,
    data
  })
}

instance.delete = function (url, params = {}) {
  return this.request({
    method: 'delete',
    url,
    params
  })
}

export default instance