<template>
  <div class="page-container">
    <!-- 用户卡片 -->
    <div class="user-card card">
      <div class="avatar">
        <van-image v-if="user.avatar" :src="avatarUrl" width="64" height="64" fit="cover" round @error="onAvatarError">
          <template v-slot:loading>
            <van-loading type="spinner" size="24" />
          </template>
          <template v-slot:error>
            <van-icon name="user-circle-o" size="64" color="#9aa3af" />
          </template>
        </van-image>
      </div>
      <div class="user-info">
        <div class="nickname">{{ user.nickname || user.username }}</div>
        <div class="username">@{{ user.username }}</div>
        <div class="role">
          <span class="role-badge" :class="user.role === 'admin' ? 'admin' : 'user'">
            {{ user.role === 'admin' ? '管理员' : '普通用户' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 信息菜单 -->
    <div class="menu-group">
      <div class="menu-item" @click="editNickname">
        <div class="menu-left">
          <van-icon name="user-o" />
          <span>昵称</span>
        </div>
        <div class="menu-right">
          <span class="value">{{ user.nickname || '未设置' }}</span>
          <van-icon name="arrow" />
        </div>
      </div>

      <div class="menu-item" @click="editAvatar">
        <div class="menu-left">
          <van-icon name="photograph-o" />
          <span>头像</span>
        </div>
        <div class="menu-right">
          <span class="value">点击更换</span>
          <van-icon name="arrow" />
        </div>
      </div>

      <div class="menu-item" @click="bindStudent">
        <div class="menu-left">
          <van-icon name="card-o" />
          <span>学号</span>
        </div>
        <div class="menu-right">
          <span class="value">{{ user.student_id || '未绑定' }}</span>
          <van-icon name="arrow" />
        </div>
      </div>

      <div class="menu-item" @click="editRealName">
        <div class="menu-left">
          <van-icon name="real-name" />
          <span>真实姓名</span>
        </div>
        <div class="menu-right">
          <span class="value">{{ user.real_name || '未设置' }}</span>
          <van-icon name="arrow" />
        </div>
      </div>

      <div class="menu-item">
        <div class="menu-left">
          <van-icon name="clock-o" />
          <span>注册时间</span>
        </div>
        <div class="menu-right">
          <span class="value">{{ formatDate(user.created_at) }}</span>
        </div>
      </div>
    </div>

    <!-- 邮箱绑定入口 -->
    <div class="menu-group">
      <div class="menu-item" @click="openEmailDialog">
        <div class="menu-left">
          <van-icon name="envelop-o" />
          <span>邮箱绑定</span>
        </div>
        <div class="menu-right">
          <span class="status-badge" :class="emailBound ? (emailVerified ? 'bound' : 'pending') : 'unbound'">
            {{ emailBound ? (emailVerified ? '已绑定' : '待验证') : '未绑定' }}
          </span>
          <van-icon name="arrow" />
        </div>
      </div>

      <!-- 定时推送开关（已绑定邮箱时显示） -->
      <div class="menu-item" v-if="emailBound && emailVerified">
        <div class="menu-left">
          <van-icon name="bell-o" />
          <span>定时推送</span>
        </div>
        <div class="menu-right">
          <van-switch v-model="subscriptionEnabled" @change="toggleSubscription" size="22px" />
        </div>
      </div>
    </div>

    <!-- 安全设置 -->
    <div class="menu-group">
      <div class="menu-item" @click="changePassword">
        <div class="menu-left">
          <van-icon name="lock-o" />
          <span>修改密码</span>
        </div>
        <div class="menu-right">
          <van-icon name="arrow" />
        </div>
      </div>

      <div class="menu-item" @click="setPlatformPassword">
        <div class="menu-left">
          <van-icon name="cluster-o" />
          <span>平台密码</span>
        </div>
        <div class="menu-right">
          <span class="value">{{ hasPlatformPassword ? '已设置' : '未设置' }}</span>
          <van-icon name="arrow" />
        </div>
      </div>
    </div>

    <!-- 平台登录状态 -->
    <div class="menu-group">
      <div class="menu-item platform-status" @click="showPlatformDetail">
        <div class="menu-left">
          <van-icon name="completed-o" />
          <span>智慧教育平台</span>
        </div>
        <div class="menu-right">
          <span class="status-badge" :class="isPlatformLoggedIn ? 'bound' : 'unbound'">
            {{ isPlatformLoggedIn ? '已登录' : '未登录' }}
          </span>
          <van-icon v-if="isPlatformLoggedIn" name="arrow" />
        </div>
      </div>
      <div v-if="isPlatformLoggedIn" class="menu-item platform-info-item">
        <div class="menu-left">
          <van-icon name="user-o" />
          <span>平台账号</span>
        </div>
        <div class="menu-right">
          <span class="value">{{ platformUsername || '未知' }}</span>
        </div>
      </div>
      <div v-if="isPlatformLoggedIn" class="menu-item platform-logout-item" @click="logoutPlatform">
        <div class="menu-left">
          <van-icon name="logout" />
          <span>退出平台登录</span>
        </div>
        <div class="menu-right">
          <van-icon name="arrow" />
        </div>
      </div>
    </div>

    <!-- 退出登录按钮 -->
    <div class="logout-btn">
      <van-button round block plain type="danger" @click="handleLogout" :loading="logoutLoading">
        退出登录
      </van-button>
    </div>

    <div class="version">版本 v1.6.0</div>

    <!-- 绑定邮箱弹窗 -->
    <van-dialog v-model:show="showBindDialog" title="绑定邮箱" confirm-button-text="确认绑定" cancel-button-text="取消"
      show-cancel-button @confirm="handleBindConfirm" @closed="resetBindForm">
      <div class="email-dialog-content">
        <van-field v-model="bindForm.email" label="邮箱" placeholder="请输入邮箱地址" type="email" :disabled="sendingCode" />
        <van-field v-model="bindForm.code" label="验证码" placeholder="请输入验证码" :disabled="binding">
          <template #button>
            <van-button size="small" :disabled="!canSendCode || sendingCode" @click="sendBindCode"
              :loading="sendingCode" type="primary" plain>
              {{ sendCodeText }}
            </van-button>
          </template>
        </van-field>
      </div>
    </van-dialog>

    <!-- 解绑邮箱弹窗 -->
    <van-dialog v-model:show="showUnbindDialog" title="解绑邮箱" confirm-button-text="确认解绑" cancel-button-text="取消"
      show-cancel-button @confirm="handleUnbindConfirm" @closed="resetUnbindForm">
      <div class="email-dialog-content">
        <van-field v-model="unbindForm.code" label="验证码" placeholder="请输入验证码">
          <template #button>
            <van-button size="small" @click="sendUnbindCode" :loading="sendingUnbindCode" type="danger" plain>
              发送验证码
            </van-button>
          </template>
        </van-field>
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { logout } from '@/api'
import { showToast, showLoadingToast, closeToast, showDialog, showConfirmDialog, showSuccessToast } from 'vant'
import axios from 'axios'
import { zhktApi } from '@/utils/zhktApi'


const appMainContent = ref(null)
const disableAppScroll = () => {
  appMainContent.value = document.querySelector('.app-main-content')
  if (appMainContent.value) {
    appMainContent.value.style.overflow = 'hidden'
  }
}

const restoreAppScroll = () => {
  if (appMainContent.value) {
    appMainContent.value.style.overflow = ''
  }
}


onBeforeUnmount(() => {
  restoreAppScroll()
})


const router = useRouter()
const store = useStore()
const logoutLoading = ref(false)

const user = computed(() => store.state.user)
const hasPlatformPassword = computed(() => !!user.value.platform_password)

// 邮箱状态
const emailBound = ref(false)
const emailVerified = ref(false)
const subscriptionEnabled = ref(false)

// 弹窗显示状态
const showBindDialog = ref(false)
const showUnbindDialog = ref(false)

// 绑定表单
const bindForm = reactive({
  email: '',
  code: ''
})

// 解绑表单
const unbindForm = reactive({
  code: ''
})

// 状态
const sendingCode = ref(false)
const binding = ref(false)
const sendingUnbindCode = ref(false)
const unbinding = ref(false)
const countdown = ref(0)

// 计算属性
const sendCodeText = computed(() => {
  if (sendingCode.value) return '发送中'
  if (countdown.value > 0) return `${countdown.value}s`
  return '发送验证码'
})

const canSendCode = computed(() => {
  return countdown.value === 0 && bindForm.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bindForm.email)
})

// 平台登录状态
const ZHKT_STORAGE_KEY = 'zhkt_login_info'
const platformLoginInfo = ref(null)
const isPlatformLoggedIn = ref(false)
const platformUsername = ref('')

// 获取邮箱状态（从 localStorage 读取）
const fetchEmailStatus = () => {
  try {
    const storedStatus = localStorage.getItem('email_status')
    if (storedStatus) {
      const status = JSON.parse(storedStatus)
      emailBound.value = status.hasEmail
      emailVerified.value = status.isVerified
      subscriptionEnabled.value = status.subscriptionEnabled
      console.log('[Profile] 从存储读取邮箱状态:', status)
    }
  } catch (error) {
    console.error('获取邮箱状态失败:', error)
  }
}

// 打开弹窗
const openEmailDialog = () => {
  if (emailBound.value && emailVerified.value) {
    showUnbindDialog.value = true
  } else {
    showBindDialog.value = true
  }
}

// 发送绑定验证码
const sendBindCode = async () => {
  if (!bindForm.email) {
    showToast('请先填写邮箱')
    return
  }

  sendingCode.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await axios.post('/api/email/send-bind-code',
      { email: bindForm.email },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (res.data.success) {
      showToast(res.data.message)
      countdown.value = 60
      const timer = setInterval(() => {
        if (countdown.value > 0) {
          countdown.value--
        } else {
          clearInterval(timer)
        }
      }, 1000)
    } else {
      showToast(res.data.message)
    }
  } catch (error) {
    showToast(error.response?.data?.message || '发送失败')
  } finally {
    sendingCode.value = false
  }
}

// 确认绑定
const handleBindConfirm = async () => {
  if (!bindForm.email) {
    showToast('请填写邮箱')
    return false
  }
  if (!bindForm.code) {
    showToast('请输入验证码')
    return false
  }

  binding.value = true
  showLoadingToast({ message: '绑定中...', forbidClick: true })

  try {
    const token = localStorage.getItem('token')
    const res = await axios.post('/api/email/bind',
      {
        email: bindForm.email,
        code: bindForm.code
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    closeToast()
    if (res.data.success) {
      showToast(res.data.message)
      // 更新邮箱状态
      emailBound.value = true
      emailVerified.value = true
      localStorage.setItem('email_status', JSON.stringify({
        hasEmail: true,
        isVerified: true,
        subscriptionEnabled: true
      }))
      return true
    } else {
      showToast(res.data.message)
      return false
    }
  } catch (error) {
    closeToast()
    showToast(error.response?.data?.message || '绑定失败')
    return false
  } finally {
    binding.value = false
  }
}

// 发送解绑验证码
const sendUnbindCode = async () => {
  sendingUnbindCode.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await axios.post('/api/email/send-unbind-code', {},
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (res.data.success) {
      showToast(res.data.message)
    } else {
      showToast(res.data.message)
    }
  } catch (error) {
    showToast(error.response?.data?.message || '发送失败')
  } finally {
    sendingUnbindCode.value = false
  }
}

// 确认解绑
const handleUnbindConfirm = async () => {
  if (!unbindForm.code) {
    showToast('请输入验证码')
    return false
  }

  unbinding.value = true
  showLoadingToast({ message: '解绑中...', forbidClick: true })

  try {
    const token = localStorage.getItem('token')
    const res = await axios.post('/api/email/unbind',
      { code: unbindForm.code },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    closeToast()
    if (res.data.success) {
      showToast(res.data.message)
      emailBound.value = false
      emailVerified.value = false
      localStorage.setItem('email_status', JSON.stringify({
        hasEmail: false,
        isVerified: false,
        subscriptionEnabled: false
      }))
      return true
    } else {
      showToast(res.data.message)
      return false
    }
  } catch (error) {
    closeToast()
    showToast(error.response?.data?.message || '解绑失败')
    return false
  } finally {
    unbinding.value = false
  }
}

// 切换定时推送
const toggleSubscription = async (enabled) => {
  try {
    const token = localStorage.getItem('token')
    const res = await axios.post('/api/email/toggle-subscription',
      { enabled },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (res.data.success) {
      showToast(res.data.message)
      subscriptionEnabled.value = enabled
      // 更新存储
      const status = JSON.parse(localStorage.getItem('email_status') || '{}')
      status.subscriptionEnabled = enabled
      localStorage.setItem('email_status', JSON.stringify(status))
    }
  } catch (error) {
    showToast(error.response?.data?.message || '操作失败')
    subscriptionEnabled.value = !enabled
  }
}

// 重置表单
const resetBindForm = () => {
  bindForm.email = ''
  bindForm.code = ''
  countdown.value = 0
}

const resetUnbindForm = () => {
  unbindForm.code = ''
}

// 头像URL
const avatarUrl = computed(() => {
  const avatar = user.value.avatar
  if (!avatar) return ''
  if (avatar.startsWith('http')) return avatar
  const baseURL = process.env.VUE_APP_API_BASE_URL === '/api'
    ? 'http://localhost:8082'
    : process.env.VUE_APP_API_BASE_URL.replace('/api', '')
  return `${baseURL}${avatar.startsWith('/') ? avatar : '/' + avatar}`
})

const onAvatarError = () => { }

const formatDate = (date) => {
  if (!date) return '未知'
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const editNickname = async () => {
  showDialog({
    title: '修改昵称',
    message: 'MB端暂不支持修改',
    confirmButtonText: '知道了'
  })
}

const editAvatar = () => {
  showDialog({
    title: '提示',
    message: 'MB端暂不支持修改',
    confirmButtonText: '知道了'
  })
}

const bindStudent = async () => {
  showDialog({
    title: '绑定学号',
    message: 'MB端暂不支持修改，请使用PC端操作',
    confirmButtonText: '知道了'
  })
}

const editRealName = async () => {
  showDialog({
    title: '修改真实姓名',
    message: 'MB端暂不支持修改，请使用PC端操作',
    confirmButtonText: '知道了'
  })
}

const changePassword = () => {
  showDialog({
    title: '修改密码',
    message: 'MB端暂不支持修改，请使用PC端操作',
    confirmButtonText: '知道了'
  })
}

const setPlatformPassword = () => {
  showDialog({
    title: '平台密码',
    message: 'MB端暂不支持修改，请使用PC端操作',
    confirmButtonText: '知道了'
  })
}

// 检查平台登录状态
const checkPlatformLoginStatus = () => {
  const saved = localStorage.getItem(ZHKT_STORAGE_KEY)
  if (saved) {
    try {
      const loginInfo = JSON.parse(saved)
      if (Date.now() - loginInfo.timestamp <= 24 * 60 * 60 * 1000 && loginInfo.token) {
        platformLoginInfo.value = loginInfo
        isPlatformLoggedIn.value = true
        platformUsername.value = loginInfo.username || '未知'
        return true
      } else {
        localStorage.removeItem(ZHKT_STORAGE_KEY)
      }
    } catch (e) {
      console.error('解析平台登录信息失败:', e)
    }
  }
  isPlatformLoggedIn.value = false
  platformLoginInfo.value = null
  platformUsername.value = ''
  return false
}

// 退出平台登录
const logoutPlatform = async () => {
  await showConfirmDialog({
    title: '提示',
    message: '确定要退出智慧教育平台登录吗？退出后需要重新登录才能使用考勤和作业功能。',
    confirmButtonText: '确定退出',
    cancelButtonText: '取消'
  })

  try {
    // 使用 zhktApi 的 logout 方法清除所有平台相关数据
    zhktApi.logout()
    isPlatformLoggedIn.value = false
    platformLoginInfo.value = null
    platformUsername.value = ''
    showSuccessToast('已退出平台登录')
  } catch (error) {
    console.error('退出平台登录失败:', error)
    showToast('退出失败')
  }
}

// 显示平台详情
const showPlatformDetail = () => {
  if (isPlatformLoggedIn.value) {
    showDialog({
      title: '平台登录信息',
      message: `账号：${platformUsername.value}\n登录时间：${formatTimestamp(platformLoginInfo.value?.timestamp)}`,
      confirmButtonText: '知道了'
    })
  } else {
    showDialog({
      title: '提示',
      message: '您尚未登录智慧教育平台，请前往登录页面勾选"协同平台登录"进行登录。',
      confirmButtonText: '知道了'
    })
  }
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '未知'
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

// 清除所有缓存
const clearAllCache = () => {
  const courseCacheKeys = [
    'persistent_classes',
    'persistent_courses',
    'persistent_has_class',
    'persistent_class_permission'
  ]
  courseCacheKeys.forEach(key => localStorage.removeItem(key))

  const homeworkCacheKeys = [
    'homework_my_courses',
    'homework_platform_courses',
    'homework_platform_homeworks',
    'homework_selected_course_id',
    'homework_active_tab',
    'homework_platform_last_update'
  ]
  homeworkCacheKeys.forEach(key => localStorage.removeItem(key))

  const sessionCacheKeys = [
    'cached_classes',
    'cached_courses',
    'cached_has_class',
    'cached_class_permission'
  ]
  sessionCacheKeys.forEach(key => sessionStorage.removeItem(key))

  localStorage.removeItem('today_schedule_cache')
  sessionStorage.removeItem('announcement_read_today')
  localStorage.removeItem('zhkt_login_info')
  localStorage.removeItem('zhkt_aes_keys')
}

// 退出系统登录
const handleLogout = async () => {
  await showConfirmDialog({
    title: '提示',
    message: '确定要退出登录吗？',
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })

  logoutLoading.value = true
  try {
    await logout()
  } catch (error) {
    console.error('登出失败:', error)
  } finally {
    // 清除所有缓存
    clearAllCache()
    // 清除 zhktApi 中的状态
    zhktApi.logout()
    // 清除 Vuex 中的用户状态
    store.dispatch('logout')
    showSuccessToast('已退出登录')
    router.replace('/login')
    logoutLoading.value = false
  }
}

onMounted(() => {
  disableAppScroll()
  checkPlatformLoginStatus()
  fetchEmailStatus()
})
</script>

<style scoped lang="scss">
.page-container {
  padding: 16px;
  min-height: 100vh;
  background: linear-gradient(145deg, #eef2f9 0%, #f8fafc 100%);
}

/* 用户卡片 - 玻璃面板 */
.user-card {

  position: sticky;
  /* 新增 */
  top: 0;
  /* 新增 */
  z-index: 10;
  /* 新增，防止被其他元素覆盖 */
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 20px;
  margin-bottom: 16px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  overflow: hidden;

  // 顶部高光线
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.4), transparent);
    border-radius: 28px 28px 0 0;
    pointer-events: none;
    z-index: 1;
  }

  .avatar {
    flex-shrink: 0;
    position: relative;
    z-index: 2;
  }

  .user-info {
    flex: 1;
    position: relative;
    z-index: 2;

    .nickname {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);
      margin-bottom: 4px;
    }

    .username {
      font-size: 13px;
      color: #475569;
      font-weight: 500;
      margin-bottom: 6px;
    }

    .role-badge {
      display: inline-block;
      padding: 2px 12px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 30px;
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.7);
      color: #1e293b;

      &.admin {
        background: rgba(229, 69, 69, 0.2);
        color: #b91c1c;
        border-color: rgba(229, 69, 69, 0.3);
      }
    }
  }
}

/* 菜单组 - 玻璃面板 */
.menu-group {
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 28px;
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  position: relative;

  // 顶部高光线
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 30%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.35), transparent);
    border-radius: 28px 28px 0 0;
    pointer-events: none;
    z-index: 1;
  }
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  z-index: 2;

  &:active {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(0.98);
  }

  &:last-child {
    border-bottom: none;
  }

  .menu-left {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    font-weight: 500;
    color: #1e293b;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);

    .van-icon {
      font-size: 18px;
      color: #475569;
    }
  }

  .menu-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .value {
      color: #475569;
      font-size: 14px;
      font-weight: 500;
    }

    .van-icon {
      color: #94a3b8;
      font-size: 14px;
    }
  }
}

/* 邮箱状态徽章 */
.status-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 20px;
  backdrop-filter: blur(4px);

  &.bound {
    background: rgba(46, 125, 50, 0.15);
    color: #2e7d32;
    border: 1px solid rgba(46, 125, 50, 0.3);
  }

  &.pending {
    background: rgba(237, 108, 2, 0.15);
    color: #ed6c02;
    border: 1px solid rgba(237, 108, 2, 0.3);
  }

  &.unbound {
    background: rgba(198, 40, 40, 0.12);
    color: #c62828;
    border: 1px solid rgba(198, 40, 40, 0.3);
  }
}

/* 平台登录相关特殊样式 */
.platform-status {
  .menu-left .van-icon {
    color: #1e293b;
  }
}

.platform-info-item {
  background: rgba(255, 255, 255, 0.1);

  .value {
    color: #1e293b;
    font-weight: 600;
  }
}

.platform-logout-item {
  .menu-left .van-icon {
    color: #e54545;
  }

  .menu-left span {
    color: #e54545;
  }

  &:active {
    background: rgba(229, 69, 69, 0.1);
  }
}

/* 退出登录按钮 - 玻璃风格 */
.logout-btn {
  margin: 24px 0 16px;

  :deep(.van-button) {
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 40px;
    height: 48px;
    font-size: 16px;
    font-weight: 600;
    color: #e54545;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
    transition: all 0.2s;

    &:active {
      transform: scale(0.97);
      background: rgba(255, 255, 255, 0.3);
    }
  }
}

.version {
  text-align: center;
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
  margin: 20px 0 10px;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
}

/* 邮箱绑定弹窗内容（保持原样，不修改弹窗本身） */
.email-dialog-content {
  padding: 16px;

  :deep(.van-field) {
    margin-bottom: 16px;
    background-color: #f5f7fa;
    border-radius: 12px;
  }
}
</style>