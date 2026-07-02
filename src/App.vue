<template>
  <div id="app">
    <!-- 维护模式覆盖层 -->
    <div v-if="showMaintenance" class="maintenance-overlay">
      <div class="maintenance-card">
        <div class="icon-area">
          <div class="icon-wrapper" @click="handleMaintenanceIconClick">
            <span>🔧</span>
          </div>
        </div>
        <h2>正在维护升级中</h2>
        <div class="subtitle">为了给您更好的体验</div>
        <div class="desc">系统正在升级优化，敬请期待</div>

        <div class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <div class="progress-text">升级进度</div>
        </div>

        <div class="notice">
          维护期间暂时无法访问
        </div>

        <button v-if="isAdmin" class="admin-btn" @click="endMaintenance">结束维护</button>
      </div>
    </div>

    <!-- 原有内容，维护模式下隐藏 -->
    <template v-else>
      <router-view />

      <!-- 毛玻璃效果底部导航栏（支持长按拖拽指示器） -->
      <div
        v-if="showTabbar"
        class="glass-tabbar-wrapper"
        ref="tabbarWrapperRef"
        @touchstart.prevent="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend.prevent="onTouchEnd"
        @touchcancel.prevent="onTouchEnd"
      >
        <LiquidGlassContainer
          :width="'100%'"
          :height="60"
          :borderRadius="24"
          :blur="10"
          :noiseFrequency="0.001"
          :opacity="0.85"
          style="display: block;"
        >
          <div class="glass-tabbar-inner" style="display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0; margin: 0;">
            <div
              v-for="(item, idx) in tabItems"
              :key="idx"
              class="glass-tabbar-item"
              :class="{ active: active === idx || (isDragging && dragActiveIndex === idx) }"
              :data-index="idx"
              ref="tabItemRefs"
              @click="!isDragging && onTabChange(idx)"
              style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 100%; text-align: center; padding: 0; margin: 0;"
            >
              <van-icon :name="item.icon" size="22" />
              <span>{{ item.label }}</span>
            </div>
          </div>
        </LiquidGlassContainer>

        <!-- 拖拽指示器（毛玻璃圆球，与导航栏高度一致） -->
        <LiquidGlassContainer
          v-if="isDragging"
          class="drag-indicator"
          :class="{ 'drag-bounce': isBouncing }"
          :width="75"
          :height="55"
          :borderRadius="40"
          :blur="16"
          :noiseFrequency="0.001"
          :opacity="0.8"
        />
      </div>

      <!-- 域名迁移弹窗 -->
      <van-dialog v-model:show="showMigrationDialog" title="网站迁移通知" confirm-button-text="立即前往新平台"
        @confirm="goToNewPlatform">
        <div style="padding: 16px; text-align: center; color: #666;">
          本网站已迁移至新平台，请点击下方按钮前往新平台获取最新内容和服务。
        </div>
      </van-dialog>

      <!-- 邮箱绑定提示弹窗 -->
      <van-dialog v-model:show="showEmailPrompt" title="💌 温馨提示" confirm-button-text="去绑定" cancel-button-text="稍后提醒"
        show-cancel-button @confirm="goToEmailBinding" @cancel="closeEmailPrompt">
        <div style="padding: 20px; text-align: center; color: #666;">
          <van-icon name="envelop-o" size="40" color="#409EFF" />
          <p style="margin-top: 12px; line-height: 1.6;">
            绑定邮箱后可接收每日学习推送，<br>及时获取课程和作业提醒。
          </p>
        </div>
      </van-dialog>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LiquidGlassContainer } from '@tinymomentum/liquid-glass-vue'

const route = useRoute()
const router = useRouter()
const active = ref(0)
const showMigrationDialog = ref(false)
const showEmailPrompt = ref(false)

const tabItems = [
  { label: '课程', icon: 'home-o', path: '/courses' },
  { label: '作业', icon: 'notes-o', path: '/homework' },
  { label: '我的', icon: 'user-o', path: '/profile' }
]

// 拖拽相关
const tabbarWrapperRef = ref(null)
const tabItemRefs = ref([])
const isDragging = ref(false)
const dragActiveIndex = ref(-1)
let touchStartTimer = null
let touchStartX = 0
let touchStartY = 0
let hasMoved = false
const LONG_PRESS_DELAY = 300
const MOVE_THRESHOLD = 5

const INDICATOR_SIZE = 60
const INDICATOR_HALF = INDICATOR_SIZE / 2

// 弹动效果相关
const isBouncing = ref(false)
let bounceTimer = null

// 触发弹动动画
const triggerBounce = () => {
  if (!isDragging.value) return
  if (bounceTimer) clearTimeout(bounceTimer)
  isBouncing.value = true
  bounceTimer = setTimeout(() => {
    isBouncing.value = false
  }, 200)
}

// 维护模式相关
const MAINTENANCE_MODE = ref(false)
const CLICK_RESET_TIME = 5000
const TEMP_OVERRIDE_KEY = 'temp_maintenance_override'
let clickCount = 0
let clickTimer = null
const isAdmin = ref(false)

const isTempOverridden = () => sessionStorage.getItem(TEMP_OVERRIDE_KEY) === 'true'

const showMaintenance = computed(() => {
  if (isTempOverridden()) return false
  const maintenanceEnded = localStorage.getItem('maintenance_ended') === 'true'
  if (maintenanceEnded) return false
  return MAINTENANCE_MODE.value
})

const resetClickCount = () => (clickCount = 0)
const handleMaintenanceIconClick = () => {
  clickCount++
  if (clickTimer) clearTimeout(clickTimer)
  clickTimer = setTimeout(() => {
    resetClickCount()
    clickTimer = null
  }, CLICK_RESET_TIME)
  if (clickCount >= 100000) {
    resetClickCount()
    if (clickTimer) clearTimeout(clickTimer)
    sessionStorage.setItem(TEMP_OVERRIDE_KEY, 'true')
    window.location.reload()
  }
}
const endMaintenance = () => {
  localStorage.setItem('maintenance_ended', 'true')
  sessionStorage.removeItem(TEMP_OVERRIDE_KEY)
  window.location.reload()
}

const showTabbar = computed(() => route.meta?.showTabbar === true)
const isDevelopment = () => process.env.NODE_ENV === 'development'

const checkDomainAndShowMigration = () => {
  if (isDevelopment()) return
  if (window.location.hostname !== 'course.zzll01.cn') showMigrationDialog.value = true
}
const goToNewPlatform = () => (window.location.href = 'https://course.zzll01.cn')

const checkEmailStatus = () => {
  try {
    const emailStatus = localStorage.getItem('email_status')
    if (emailStatus) {
      const status = JSON.parse(emailStatus)
      if (!status.hasEmail) {
        const lastPromptDate = localStorage.getItem('email_prompt_date')
        const today = new Date().toDateString()
        if (lastPromptDate !== today) {
          setTimeout(() => (showEmailPrompt.value = true), 1500)
        }
      }
    }
  } catch (error) {
    console.error(error)
  }
}
const handleLoginSuccess = () => setTimeout(() => checkEmailStatus(), 500)
const goToEmailBinding = () => {
  showEmailPrompt.value = false
  localStorage.setItem('email_prompt_date', new Date().toDateString())
  router.push('/profile')
}
const closeEmailPrompt = () => {
  showEmailPrompt.value = false
  localStorage.setItem('email_prompt_date', new Date().toDateString())
}

watch(() => route.path, (newPath) => {
  if (route.meta?.showTabbar) {
    if (newPath === '/courses') active.value = 0
    else if (newPath === '/homework') active.value = 1
    else if (newPath === '/profile') active.value = 2
  }
})

const onTabChange = (index) => {
  active.value = index
  router.push(tabItems[index].path)
}

const getTargetIndexFromTouch = (clientX) => {
  if (!tabItemRefs.value.length) return -1
  for (let i = 0; i < tabItemRefs.value.length; i++) {
    const rect = tabItemRefs.value[i].getBoundingClientRect()
    if (clientX >= rect.left && clientX <= rect.right) return i
  }
  return -1
}

// 优化位置更新：使用 requestAnimationFrame 平滑更新
const updateIndicatorPosition = (clientX) => {
  if (!tabbarWrapperRef.value) return
  const wrapperRect = tabbarWrapperRef.value.getBoundingClientRect()
  let left = clientX - wrapperRect.left - INDICATOR_HALF
  left = Math.max(0, Math.min(left, wrapperRect.width - INDICATOR_SIZE))
  const indicator = document.querySelector('.drag-indicator')
  if (indicator) {
    requestAnimationFrame(() => {
      indicator.style.left = `${left}px`
    })
  }
}

const resetDrag = () => {
  if (touchStartTimer) clearTimeout(touchStartTimer)
  isDragging.value = false
  dragActiveIndex.value = -1
  hasMoved = false
  if (bounceTimer) clearTimeout(bounceTimer)
  isBouncing.value = false
}

// 长按触发：立即显示指示器并设置位置，并触发弹入动画
const onTouchStart = (e) => {
  const touch = e.touches[0]
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  hasMoved = false
  touchStartTimer = setTimeout(() => {
    // 立即进入拖拽模式
    isDragging.value = true
    const idx = getTargetIndexFromTouch(touchStartX)
    dragActiveIndex.value = idx !== -1 ? idx : -1
    // 更新指示器位置
    updateIndicatorPosition(touchStartX)
    // 触发弹入动画（开始拖拽时的弹动效果）
    nextTick(() => {
      triggerBounce()
    })
    touchStartTimer = null
  }, LONG_PRESS_DELAY)
}

const onTouchMove = (e) => {
  const touch = e.touches[0]
  const deltaX = Math.abs(touch.clientX - touchStartX)
  const deltaY = Math.abs(touch.clientY - touchStartY)
  if (!isDragging.value) {
    if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
      if (touchStartTimer) clearTimeout(touchStartTimer)
      hasMoved = true
    }
    return
  }
  e.preventDefault()
  const clientX = touch.clientX
  updateIndicatorPosition(clientX)
  const idx = getTargetIndexFromTouch(clientX)
  if (idx !== -1 && dragActiveIndex.value !== idx) {
    dragActiveIndex.value = idx
    // 跨越不同 tab 项时触发弹动效果
    triggerBounce()
  } else if (idx === -1) {
    dragActiveIndex.value = -1
  }
}

const onTouchEnd = (e) => {
  if (touchStartTimer) {
    clearTimeout(touchStartTimer)
    if (!hasMoved) {
      const clientX = e.changedTouches[0].clientX
      const idx = getTargetIndexFromTouch(clientX)
      if (idx !== -1 && idx !== active.value) onTabChange(idx)
    }
    resetDrag()
    return
  }
  if (isDragging.value) {
    if (dragActiveIndex.value !== -1 && dragActiveIndex.value !== active.value) {
      onTabChange(dragActiveIndex.value)
    }
    resetDrag()
  }
}

const watchTokenChange = () => {
  let currentToken = localStorage.getItem('token')
  setInterval(() => {
    const newToken = localStorage.getItem('token')
    if (newToken !== currentToken) {
      currentToken = newToken
      if (newToken) setTimeout(() => checkEmailStatus(), 500)
    }
  }, 2000)
}

window.setMaintenanceMode = (enabled) => {
  if (enabled) {
    localStorage.removeItem('maintenance_ended')
    sessionStorage.removeItem(TEMP_OVERRIDE_KEY)
  } else {
    localStorage.setItem('maintenance_ended', 'true')
    sessionStorage.removeItem(TEMP_OVERRIDE_KEY)
  }
  window.location.reload()
}
window.getMaintenanceStatus = () => ({
  maintenanceMode: MAINTENANCE_MODE.value,
  isTempOverridden: sessionStorage.getItem(TEMP_OVERRIDE_KEY) === 'true',
  isEnded: localStorage.getItem('maintenance_ended') === 'true',
  isActive: !sessionStorage.getItem(TEMP_OVERRIDE_KEY) && !localStorage.getItem('maintenance_ended') && MAINTENANCE_MODE.value
})

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('admin') === '1') isAdmin.value = true
  if (urlParams.get('remaint') === '1') {
    localStorage.removeItem('maintenance_ended')
    sessionStorage.removeItem(TEMP_OVERRIDE_KEY)
    window.location.reload()
  }
  checkDomainAndShowMigration()
  watchTokenChange()
  window.addEventListener('login-success', handleLoginSuccess)
  const token = localStorage.getItem('token')
  if (token) setTimeout(() => checkEmailStatus(), 500)
})

onUnmounted(() => {
  window.removeEventListener('login-success', handleLoginSuccess)
  if (clickTimer) clearTimeout(clickTimer)
  if (touchStartTimer) clearTimeout(touchStartTimer)
  if (bounceTimer) clearTimeout(bounceTimer)
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  background-color: #f5f7fa;
  color: #1f2d3d;
}
#app {
  height: 100vh;
  overflow: hidden;
  position: relative;
}
.card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: box-shadow 0.2s;
}
.card:active {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.page-container {
  height: 100%;
  overflow-y: auto;
  background-color: #f5f7fa;
  padding: 16px;
  padding-bottom: 80px;
  box-sizing: border-box;
}
input, textarea, .van-field__control {
  font-size: 16px !important;
}
.van-dialog__header {
  font-weight: 600;
  font-size: 18px;
}

/* 底部导航栏容器 - 固定底部 */
.glass-tabbar-wrapper {
  position: fixed;
  bottom: 16px;
  left: 16px;
  right: 16px;
  z-index: 1000;
}
.glass-tabbar-wrapper .liquid-glass-container:first-child {
  width: 100% !important;
  border-radius: 24px !important;
  overflow: hidden !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}
.glass-tabbar-item span {
  font-size: 11px;
  font-weight: 500;
}
.glass-tabbar-item:active {
  transform: scale(0.95);
}
.glass-tabbar-item.active {
  color: #1a73e8 !important;
}

/* 拖拽指示器 - 优化性能 + 弹动效果 */
.drag-indicator {
  position: absolute !important;
  top: 50% !important;
  transform: translateY(-50%);
  left: 0;
  pointer-events: none;
  z-index: 1100;
  transition: left 0.01s linear, transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1);
  will-change: left, transform;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  width: 75px !important;
  height: 55px !important;
  border-radius: 30px !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* 弹动动画：缩放脉冲效果 */
.drag-indicator.drag-bounce {
  transform: translateY(-50%) scale(1.25) !important;
}

/* 响应式 */
@media (max-width: 480px) {
  .glass-tabbar-wrapper {
    left: 12px;
    right: 12px;
    bottom: 12px;
  }
  .glass-tabbar-wrapper .liquid-glass-container:first-child {
    border-radius: 20px !important;
  }
}
@media (min-width: 768px) {
  .glass-tabbar-wrapper {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: 600px;
  }
}
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .glass-tabbar-wrapper {
    bottom: calc(16px + env(safe-area-inset-bottom));
  }
}

/* 维护模式样式（保持不变） */
.maintenance-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #f8fafc;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.maintenance-card {
  width: 100%;
  max-width: 400px;
  background: #ffffff;
  border-radius: 32px;
  padding: 40px 28px 48px;
  box-shadow: 0 20px 35px -12px rgba(0, 0, 0, 0.08);
  text-align: center;
}
.icon-area { text-align: center; margin-bottom: 32px; }
.icon-wrapper {
  width: 72px;
  height: 72px;
  background: #eef2ff;
  border-radius: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.icon-wrapper:active { transform: scale(0.95); background: #e0e7ff; }
.icon-wrapper span { font-size: 36px; }
.maintenance-card h2 {
  font-size: 26px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}
.maintenance-card .subtitle { font-size: 15px; color: #64748b; margin-bottom: 8px; }
.maintenance-card .desc { font-size: 13px; color: #94a3b8; margin-bottom: 28px; }
.progress-section { margin: 24px 0 20px; }
.progress-bar { background: #e2e8f0; border-radius: 10px; height: 6px; overflow: hidden; }
.progress-fill { width: 68%; height: 100%; background: #1e293b; border-radius: 10px; }
.progress-text { font-size: 11px; color: #94a3b8; margin-top: 10px; }
.notice { background: #f8fafc; border-radius: 16px; padding: 12px 16px; font-size: 12px; color: #64748b; margin: 20px 0 24px; }
.admin-btn { background: none; border: none; font-size: 12px; color: #94a3b8; padding: 8px 16px; cursor: pointer; transition: color 0.2s; }
.admin-btn:active { color: #1e293b; }
</style>