<template>
  <div class="login-container">
    <!-- 维护模式下的特殊界面 -->
    <div class="login-card" v-if="showMaintenanceOnly">
      <div class="logo-area">
        <div class="logo-icon" @click="handleLogoClick">
          <van-icon name="star-o" size="32" />
        </div>
        <h2>Zzll_Course</h2>
        <p>课程考勤系统</p>
      </div>

      <div class="maintenance-message">
        <van-icon name="warning-o" size="48" style="color: #ff976a;" />
        <h3>系统维护中</h3>
        <p>系统正在维护升级，暂时无法登录</p>
        <p class="hint">如需紧急访问，请联系管理员</p>
        <div class="click-hint" v-if="clickCount > 0">
          已点击 {{ clickCount }} / 10 次
        </div>
      </div>
    </div>

    <!-- 正常登录界面（隐藏模式或非维护状态时显示） -->
    <div class="login-card" v-else>
      <div class="logo-area">
        <div class="logo-icon" @click="handleLogoClick">
          <van-icon name="star-o" size="32" />
        </div>
        <h2>Zzll_Course</h2>
        <p>课程考勤系统</p>
      </div>

      <van-form @submit="onSubmit">
        <van-field v-model="form.username" name="username" placeholder="用户名"
          :rules="[{ required: true, message: '请输入用户名' }]" :disabled="platformLoginEnabled && showCaptcha">
          <template #left-icon>
            <van-icon name="user-o" />
          </template>
        </van-field>

        <van-field v-model="form.password" :type="showPassword ? 'text' : 'password'" name="password" placeholder="密码"
          :rules="[{ required: true, message: '请输入密码' }]" :disabled="platformLoginEnabled && showCaptcha">
          <template #left-icon>
            <van-icon name="lock-o" />
          </template>
          <template #right-icon>
            <van-icon :name="showPassword ? 'eye-o' : 'closed-eye'" @click="togglePasswordVisibility"
              class="password-eye" />
          </template>
        </van-field>

        <!-- 记住我 和 协同平台登录选项 -->
        <div class="options-row">
          <van-checkbox v-model="rememberMe" @change="onRememberMeChange">
            记住我
          </van-checkbox>
          <van-checkbox v-model="platformLoginEnabled" @change="onPlatformLoginChange">
            协同平台登录
          </van-checkbox>
        </div>

        <!-- 平台验证码（获取绑定信息后显示） -->
        <van-field v-if="platformLoginEnabled && showCaptcha" v-model="form.platformCaptcha" name="platformCaptcha"
          placeholder="平台验证码" :rules="[{ required: true, message: '请输入平台验证码' }]">
          <template #left-icon>
            <van-icon name="certificate" />
          </template>
          <template #button>
            <div class="captcha-image" @click="loadPlatformCaptcha">
              <img v-if="captchaImage" :src="captchaImage" alt="验证码" />
              <span v-else>点击加载</span>
            </div>
          </template>
        </van-field>

        <div class="login-btn">
          <van-button round block type="primary" native-type="submit" :loading="loading">
            {{ loading ? '登录中...' : '登录' }}
          </van-button>
        </div>
      </van-form>

      <div class="extra-links">
        <span>还没有账号？</span>
        <span class="link">联系管理员</span>
      </div>
    </div>

    <!-- 域名迁移弹窗 -->
    <van-dialog v-model:show="showMigrationDialog" title="网站迁移通知" confirm-button-text="立即前往新平台"
      @confirm="goToNewPlatform" close-on-click-overlay>
      <div style="padding: 16px; text-align: center; color: #666;">
        本网站已迁移至新平台，请点击下方按钮前往新平台获取最新内容和服务。
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { login, getPlatformCredentials } from '@/api'
import { showSuccessToast, showFailToast, showLoadingToast, closeToast } from 'vant'
import { zhktApi } from '@/utils/zhktApi'
import CryptoJS from 'crypto-js'

const router = useRouter()
const store = useStore()
const form = reactive({ username: '', password: '', platformCaptcha: '' })
const loading = ref(false)
const showPassword = ref(false)

// 域名迁移弹窗
const showMigrationDialog = ref(false)

// 维护状态相关
const MAINTENANCE_KEY = 'system_maintenance_mode'
const HIDDEN_MODE_KEY = 'system_hidden_mode_active'
const CLICK_COUNT_KEY = 'logo_click_count'
const CLICK_RESET_TIME = 5000 // 5秒内未连续点击则重置计数
let clickTimer = null
const clickCount = ref(0)

// 检查是否处于隐藏模式（绕过维护）
const isHiddenMode = computed(() => {
  return localStorage.getItem(HIDDEN_MODE_KEY) === 'true'
})

// 获取维护状态
const getMaintenanceStatus = () => {
  return localStorage.getItem(MAINTENANCE_KEY) === 'true'
}

// 设置维护状态
const setMaintenanceStatus = (isMaintenance) => {
  localStorage.setItem(MAINTENANCE_KEY, String(isMaintenance))
}

// 是否只显示维护界面（维护中 且 未开启隐藏模式）
const showMaintenanceOnly = computed(() => {
  return getMaintenanceStatus() && !isHiddenMode.value
})

// 重置点击计数
const resetClickCount = () => {
  clickCount.value = 0
  localStorage.removeItem(CLICK_COUNT_KEY)
}

// 处理logo点击（10次隐藏维护模式）
const handleLogoClick = () => {
  // 如果不在维护状态，不需要点击绕过
  if (!getMaintenanceStatus()) {
    return
  }

  // 获取当前点击次数
  let currentCount = parseInt(localStorage.getItem(CLICK_COUNT_KEY) || '0')
  currentCount++
  clickCount.value = currentCount
  localStorage.setItem(CLICK_COUNT_KEY, String(currentCount))

  // 重置计时器
  if (clickTimer) {
    clearTimeout(clickTimer)
  }

  // 设置5秒后重置计数
  clickTimer = setTimeout(() => {
    resetClickCount()
    clickTimer = null
  }, CLICK_RESET_TIME)

  // 达到10次点击
  if (currentCount >= 10) {
    resetClickCount()
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
    }

    // 激活隐藏模式
    localStorage.setItem(HIDDEN_MODE_KEY, 'true')
    showSuccessToast('已临时恢复访问')
    // 刷新页面显示登录表单
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }
}

// 判断是否为开发环境
const isDevelopment = () => {
  const hostname = window.location.hostname
  return hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    process.env.NODE_ENV === 'development'
}

// 检查域名并显示迁移弹窗
const checkDomainAndShowMigration = () => {
  if (isDevelopment()) return
  if (window.location.hostname !== 'course.zzll01.cn') {
    showMigrationDialog.value = true
  }
}

const goToNewPlatform = () => {
  window.location.href = 'https://course.zzll01.cn'
}

// 记住我相关
const rememberMe = ref(false)
const STORAGE_KEY = 'saved_login_info'

// 协同平台登录相关
const platformLoginEnabled = ref(false)
const showCaptcha = ref(false)
const captchaImage = ref('')
const captchaKey = ref(null)
const platformCredentials = ref({ studentId: '', encryptedPassword: '' })
const systemToken = ref('')
const systemUser = ref(null)

// AES解密配置（用于解密后端返回的加密密码）
const AES_KEY = CryptoJS.enc.Utf8.parse('xa345678901234iu')
const AES_IV = CryptoJS.enc.Utf8.parse('1234xa789012iu56')

// 清除所有应用缓存
const clearAllAppCache = () => {
  console.log('[前端] 开始清除所有应用缓存...')
  const courseCacheKeys = [
    'persistent_classes',
    'persistent_courses',
    'persistent_has_class',
    'persistent_class_permission'
  ]
  courseCacheKeys.forEach(key => {
    localStorage.removeItem(key)
  })

  const homeworkCacheKeys = [
    'homework_my_courses',
    'homework_platform_courses',
    'homework_platform_homeworks',
    'homework_selected_course_id',
    'homework_active_tab'
  ]
  homeworkCacheKeys.forEach(key => {
    localStorage.removeItem(key)
  })

  const sessionCacheKeys = [
    'cached_classes',
    'cached_courses',
    'cached_has_class',
    'cached_class_permission'
  ]
  sessionCacheKeys.forEach(key => {
    sessionStorage.removeItem(key)
  })

  localStorage.removeItem('today_schedule_cache')
  sessionStorage.removeItem('announcement_read_today')

  // 清除平台登录相关信息
  zhktApi.logout()

  console.log('[前端] 所有应用缓存已清除')
}

// 保存登录信息到本地
const saveLoginInfo = () => {
  if (rememberMe.value && form.username) {
    const infoToSave = {
      username: form.username,
      password: form.password,
      timestamp: Date.now()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(infoToSave))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

// 加载保存的登录信息
const loadSavedLoginInfo = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const info = JSON.parse(saved)
      const maxAge = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - info.timestamp < maxAge) {
        form.username = info.username || ''
        form.password = info.password || ''
        rememberMe.value = true
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  } catch (error) {
    console.error('加载保存的登录信息失败:', error)
  }
}

const onRememberMeChange = (val) => {
  if (!val) {
    localStorage.removeItem(STORAGE_KEY)
  }
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

// 解密后端返回的加密密码
const decryptPassword = (encrypted) => {
  if (!encrypted) return ''
  try {
    let padded = encrypted
    while (padded.length % 4) padded += '='
    const decrypted = CryptoJS.AES.decrypt(padded, AES_KEY, {
      iv: AES_IV,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.ZeroPadding
    })
    return decrypted.toString(CryptoJS.enc.Utf8)
  } catch (e) {
    console.error('密码解密失败:', e)
    return ''
  }
}

// 系统登录
const systemLogin = async () => {
  if (!form.username || !form.password) {
    showFailToast('请填写用户名和密码')
    return false
  }

  try {
    const res = await login({ username: form.username, password: form.password })
    if (!res.success) {
      showFailToast(res.message || '系统登录失败')
      return false
    }

    systemToken.value = res.token
    systemUser.value = res.user
    store.dispatch('login', { token: res.token, user: res.user })

    // 保存邮箱状态到 localStorage
    if (res.emailStatus) {
      localStorage.setItem('email_status', JSON.stringify(res.emailStatus))
      console.log('[登录] 保存邮箱状态:', res.emailStatus)
    } else {
      localStorage.setItem('email_status', JSON.stringify({
        hasEmail: false,
        isVerified: false,
        subscriptionEnabled: false
      }))
    }

    saveLoginInfo()
    return true
  } catch (error) {
    console.error('系统登录失败:', error)
    showFailToast(error.message || '系统登录失败')
    return false
  }
}

// 获取平台凭据
const fetchPlatformCredentials = async () => {
  showLoadingToast({ message: '获取绑定信息...', forbidClick: true })
  try {
    const res = await getPlatformCredentials()
    if (res.success && res.data.hasCredentials) {
      platformCredentials.value = {
        studentId: res.data.studentId,
        encryptedPassword: res.data.encryptedPassword
      }
      showSuccessToast('已获取绑定平台信息')
      showCaptcha.value = true
      await loadPlatformCaptcha()
      return true
    } else {
      showFailToast(res.message || '未绑定平台账号，请先在个人中心绑定')
      platformLoginEnabled.value = false
      showCaptcha.value = false
      return false
    }
  } catch (error) {
    console.error('获取平台凭据失败:', error)
    showFailToast('获取平台信息失败')
    return false
  } finally {
    closeToast()
  }
}

// 加载平台验证码（使用统一的 zhktApi）
const loadPlatformCaptcha = async () => {
  if (!platformLoginEnabled.value) return
  try {
    const result = await zhktApi.getCaptcha()
    if (result) {
      captchaImage.value = result.image
      captchaKey.value = result.key
    } else {
      showFailToast('获取验证码失败，请重试')
    }
  } catch (error) {
    console.error('获取验证码失败:', error)
    showFailToast('获取验证码失败，请重试')
  }
}

// 执行平台登录（使用统一的 zhktApi，带进度）
const doPlatformLogin = async () => {
  if (!platformCredentials.value.studentId) {
    return { success: false, message: '未绑定平台账号' }
  }
  if (!form.platformCaptcha) {
    return { success: false, message: '请输入平台验证码' }
  }

  try {
    // 解密密码
    const password = decryptPassword(platformCredentials.value.encryptedPassword)

    // 使用统一的 zhktApi 登录，传入进度回调
    const result = await zhktApi.login(
      platformCredentials.value.studentId,
      password,
      form.platformCaptcha,
      captchaKey.value,
    )

    return result
  } catch (error) {
    console.error('平台登录失败:', error)
    return { success: false, message: '平台登录失败，请重试' }
  }
}

// 协同平台登录开关变化
const onPlatformLoginChange = async (val) => {
  if (val) {
    loading.value = true
    showLoadingToast({ message: '系统登录中...', forbidClick: true })

    try {
      clearAllAppCache()

      // 1. 系统登录
      const loginSuccess = await systemLogin()
      if (!loginSuccess) {
        platformLoginEnabled.value = false
        return
      }

      // 2. 获取平台绑定信息
      const bindSuccess = await fetchPlatformCredentials()
      if (!bindSuccess) {
        platformLoginEnabled.value = false
        return
      }

      showSuccessToast('请填写平台验证码后点击登录')

    } catch (error) {
      console.error('协同登录准备失败:', error)
      platformLoginEnabled.value = false
      showFailToast('协同登录准备失败')
    } finally {
      loading.value = false
      closeToast()
    }
  } else {
    // 关闭协同登录时重置状态
    showCaptcha.value = false
    form.platformCaptcha = ''
    captchaImage.value = ''
    captchaKey.value = null
    platformCredentials.value = { studentId: '', encryptedPassword: '' }
  }
}

// 提交登录
const onSubmit = async () => {
  // 检查维护状态（如果处于维护模式且没有隐藏模式，阻止登录）
  if (getMaintenanceStatus() && !isHiddenMode.value) {
    showFailToast('系统维护中，请稍后再试')
    return
  }

  const currentHostname = window.location.hostname
  const targetDomain = 'course.zzll01.cn'
  if (!isDevelopment() && currentHostname !== targetDomain) {
    showMigrationDialog.value = true
    return
  }

  if (!form.username || !form.password) {
    showFailToast('请填写用户名和密码')
    return
  }

  clearAllAppCache()

  // 普通登录
  if (!platformLoginEnabled.value) {
    loading.value = true
    showLoadingToast({ message: '登录中...', forbidClick: true })

    try {
      const success = await systemLogin()
      if (success) {
        showSuccessToast('登录成功')
        sessionStorage.removeItem('announcement_read_today')

        // 触发邮箱检查事件
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('login-success'))
        }, 500)

        setTimeout(() => router.replace('/courses'), 500)
      }
    } catch (error) {
      showFailToast(error.message || '登录失败')
    } finally {
      loading.value = false
      closeToast()
    }
    return
  }

  // 协同登录
  if (!showCaptcha.value) {
    showFailToast('请等待绑定信息加载完成')
    return
  }

  if (!form.platformCaptcha) {
    showFailToast('请输入平台验证码')
    return
  }

  loading.value = true
  let progressMessage = '正在初始化...'
  showLoadingToast({
    message: progressMessage,
    forbidClick: true,
    duration: 0
  })

  // 更新进度消息
  const updateProgress = (msg) => {
    progressMessage = msg
    showLoadingToast(private$1 => {
      private$1.message = progressMessage
    })
  }

  try {
    const platformResult = await doPlatformLogin(updateProgress)
    closeToast()

    if (!platformResult.success) {
      showFailToast(platformResult.message)
      return
    }

    showSuccessToast('登录成功')
    sessionStorage.removeItem('announcement_read_today')

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('login-success'))
    }, 500)

    setTimeout(() => router.replace('/courses'), 500)
  } catch (error) {
    closeToast()
    showFailToast(error.message || '平台登录失败')
  } finally {
    loading.value = false
  }
}

// 提供一个全局方法，供管理员设置维护状态
window.setSystemMaintenance = (isMaintenance) => {
  setMaintenanceStatus(isMaintenance)
  if (!isMaintenance) {
    localStorage.removeItem(HIDDEN_MODE_KEY)
  }
  showSuccessToast(`维护模式已${isMaintenance ? '开启' : '关闭'}`)
  setTimeout(() => {
    window.location.reload()
  }, 500)
}

// 检查并恢复点击计数显示
const restoreClickCount = () => {
  const savedCount = localStorage.getItem(CLICK_COUNT_KEY)
  if (savedCount) {
    clickCount.value = parseInt(savedCount)
  }
}

onMounted(() => {
  // 恢复点击计数
  restoreClickCount()

  // 如果不在维护状态，正常加载登录信息
  if (!getMaintenanceStatus() || isHiddenMode.value) {
    loadSavedLoginInfo()
  }

  checkDomainAndShowMigration()
})
</script>

<style scoped lang="scss">
.login-container {
  min-height: 100vh;
  background: linear-gradient(145deg, #e9f0fa 0%, #d9e2ef 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  
  // 增加轻微噪点质感（可选）
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 20% 40%, rgba(255,255,240,0.1) 0%, rgba(200,210,230,0.2) 100%);
    pointer-events: none;
  }
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 40px;
  padding: 40px 28px 48px;
  box-shadow: 0 25px 40px -12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.6) inset;
  border: 1px solid rgba(255, 255, 255, 0.8);
  transition: all 0.3s ease;
  
  // 强化玻璃质感
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 40px;
    background: radial-gradient(circle at 30% 20%, rgba(255,255,245,0.4), rgba(255,255,255,0.1));
    pointer-events: none;
  }
}

.logo-area {
  text-align: center;
  margin-bottom: 40px;
  position: relative;
  z-index: 1;

  .logo-icon {
    width: 64px;
    height: 64px;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(4px);
    border-radius: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    color: #1e3a8a;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8);

    &:active {
      transform: scale(0.95);
      background: rgba(255, 255, 255, 0.9);
    }
  }

  h2 {
    font-size: 28px;
    font-weight: 700;
    color: #0b2b4f;
    margin-bottom: 8px;
    letter-spacing: 1px;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
  }

  p {
    font-size: 14px;
    color: #2c3e66;
    font-weight: 500;
    text-shadow: 0 0 2px rgba(255, 255, 255, 0.3);
  }
}

.maintenance-message {
  text-align: center;
  padding: 20px 20px 40px;

  h3 {
    font-size: 20px;
    color: #0f172a;
    margin: 16px 0 8px;
  }

  p {
    color: #1e2a44;
    margin: 8px 0;
    line-height: 1.5;

    &.hint {
      font-size: 12px;
      color: #334155;
      margin-top: 16px;
    }
  }

  .click-hint {
    margin-top: 24px;
    font-size: 14px;
    color: #1e40af;
    font-weight: 500;
  }
}

:deep(.van-field) {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(4px);
  border-radius: 20px;
  margin-bottom: 16px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  transition: all 0.2s;
  
  .van-field__control {
    background-color: transparent;
    color: #1f2d3d;
    &::placeholder {
      color: #5a6e8a;
    }
  }
  
  .van-icon {
    color: #2c3e66;
  }
}

.password-eye {
  font-size: 18px;
  color: #2c3e66;
  cursor: pointer;
}

.options-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 4px;

  :deep(.van-checkbox) {
    .van-checkbox__label {
      font-size: 14px;
      color: #1e2f44;
      font-weight: 500;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
    }
    .van-checkbox__icon {
      background: rgba(255,255,240,0.5);
      border-radius: 6px;
    }
  }
}

.captcha-image {
  width: 100px;
  height: 36px;
  background: rgba(230, 240, 250, 0.6);
  backdrop-filter: blur(2px);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  margin-right: 4px;
  border: 1px solid rgba(255, 255, 255, 0.6);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  span {
    font-size: 12px;
    color: #2c3e66;
  }
}

.login-btn {
  margin: 32px 0 20px;

  .van-button {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: none;
    height: 48px;
    font-weight: 600;
    font-size: 16px;
    border-radius: 30px;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transition: all 0.2s;
    
    &:active {
      transform: scale(0.98);
    }
  }
}

.extra-links {
  text-align: center;
  font-size: 13px;
  color: #2c3e66;
  font-weight: 500;

  .link {
    color: #0b2b4f;
    margin-left: 4px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
}
</style>