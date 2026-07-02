<template>
  <div class="attendance-page">
    <!-- 顶部导航 -->
    <div class="nav-bar">
      <van-icon name="arrow-left" @click="goBack" />
      <span class="title">考勤记录</span>
      <van-icon name="replay" @click="manualRefresh" :class="{ 'refreshing': manualRefreshing }" />
    </div>

    <!-- 未登录提示 -->
    <div v-if="!isLoggedIn" class="login-tip">
      <van-icon name="info-o" size="48" color="#1e293b" />
      <p>请先登录智慧教育平台</p>
      <van-button type="primary" round @click="openLoginDialog">立即登录</van-button>
    </div>

    <!-- 已登录内容 -->
    <template v-else>
      <!-- 当前考勤区域 -->
      <div class="current-section">
        <div v-if="activeRegister" class="current-card">
          <div class="label">📢 当前考勤</div>
          <div class="code-area">
            <div v-if="showQrCode" class="qrcode-wrapper">
              <img :src="qrCodeUrl" alt="考勤二维码" class="qrcode-img" />
              <div class="qrcode-tip">扫码签到</div>
            </div>
            <div v-else class="big-code">{{ activeRegister.registerKey }}</div>
          </div>
          <div class="course-name">{{ activeRegister.name }}</div>
          <div class="attendance-type">
            <van-tag type="primary" plain size="small">{{ getAttendanceTypeText(activeRegister.type) }}</van-tag>
          </div>
          <div class="button-group">
            <van-button class="black-btn" round block :disabled="isActiveCompleted" :loading="submitting"
              @click="handleDoRegister">
              {{ isActiveCompleted ? '已签到' : '立即考勤' }}
            </van-button>
            <van-button v-if="activeRegister.type === '4'" class="black-btn outline" round block @click="toggleQrCode">
              {{ showQrCode ? '显示考勤码' : '展示二维码' }}
            </van-button>
          </div>
          <div class="back-default" v-if="isShowingHistory" @click="resetToDefault">
            <van-icon name="arrow-left" /> 返回今日默认考勤
          </div>
        </div>

        <div v-else-if="!loading && allRegisters.length === 0" class="no-attendance">
          <van-icon name="clock-o" size="48" color="#94a3b8" />
          <p>暂无考勤记录</p>
        </div>

        <div v-else-if="!hasTodayAttendance && allRegisters.length > 0" class="no-current-tip">
          <van-icon name="calendar-o" size="32" color="#94a3b8" />
          <p>今日暂无考勤</p>
          <p class="sub-tip">点击下方历史记录可重新考勤</p>
        </div>
      </div>

      <!-- 历史考勤列表 -->
      <div class="history-section" v-if="historyList.length > 0">
        <div class="section-title">
          <span>历史考勤</span>
          <span class="update-time" v-if="lastUpdateTime">最后更新: {{ lastUpdateTime }}</span>
        </div>
        <div class="history-list-container">
          <div class="history-list">
            <div v-for="item in historyList" :key="item.id" class="history-item"
              :class="{ 'active-item': activeRegister && activeRegister.id === item.id }" @click="selectRegister(item)">
              <div class="item-name">{{ item.name }}</div>
              <div class="item-meta">
                <span>考勤码：{{ item.registerKey }}</span>
                <span :class="getStatusClass(item)" class="status-badge">
                  {{ getStatusText(item) }}
                </span>
              </div>
              <div class="item-detail">
                <span class="attendance-type-text">{{ getAttendanceTypeText(item.type) }}</span>
                <span class="item-time">{{ item.updateTime || item.createTime }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 登录弹窗 -->
    <ZhktLoginDialog v-model:visible="showLoginDialog" :username="platformCredentials.studentId"
      :encrypted-password="platformCredentials.encryptedPassword" @login-success="onLoginSuccess"
      @login-fail="onLoginFail" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showSuccessToast, showFailToast, showLoadingToast, closeToast } from 'vant';
import QRCode from 'qrcode';
import request from '@/utils/request';
import { zhktApi } from '@/utils/zhktApi';
import ZhktLoginDialog from '@/components/ZhktLoginDialog.vue';

const router = useRouter();
const route = useRoute();

// 课程信息
const courseTeacherId = ref(route.query.courseTeacherId);
const teacherNo = ref(route.query.teacherNo || '');

// 考勤数据
const allRegisters = ref([]);
const historyList = ref([]);
const loading = ref(false);
const submitting = ref(false);
const manualRefreshing = ref(false);
const lastUpdateTime = ref('');
const serverUpdateTime = ref('');

// 当前选中的考勤记录
const activeRegister = ref(null);
const isShowingHistory = ref(false);
const showQrCode = ref(false);
const qrCodeUrl = ref('');

// 定时器
let autoRefreshTimer = null;
const AUTO_REFRESH_INTERVAL = 30000;
const MAX_UPDATE_INTERVAL = 10 * 60 * 1000;

// 平台登录状态
const isLoggedIn = ref(false);
const showLoginDialog = ref(false);
const platformCredentials = ref({ studentId: '', encryptedPassword: '' });

// 辅助函数
const isToday = (dateStr) => {
  if (!dateStr) return false;
  const today = new Date();
  const date = new Date(dateStr);
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
};

const hasTodayAttendance = computed(() => {
  return allRegisters.value.some(item => isToday(item.createTime));
});

const getDefaultActiveRegister = () => {
  const todayItems = allRegisters.value.filter(item => isToday(item.createTime));
  const unfinished = todayItems.find(item => !isFinishedStatus(item.registerStatus));
  if (unfinished) return unfinished;
  if (todayItems.length) return todayItems[0];
  return null;
};

const isFinishedStatus = (status) => {
  return ['0', '1', '2', '3', '4', '5', '6'].includes(status);
};

const isActiveCompleted = computed(() => {
  if (!activeRegister.value) return false;
  return isFinishedStatus(activeRegister.value.registerStatus);
});

const resetToDefault = () => {
  const defaultReg = getDefaultActiveRegister();
  activeRegister.value = defaultReg;
  isShowingHistory.value = false;
  showQrCode.value = false;
  if (defaultReg && defaultReg.type === '4') {
    generateQrCode(defaultReg.registerKey);
  } else {
    qrCodeUrl.value = '';
  }
};

const selectRegister = (item) => {
  activeRegister.value = item;
  isShowingHistory.value = true;
  showQrCode.value = false;
  if (item.type === '4') {
    generateQrCode(item.registerKey);
  } else {
    qrCodeUrl.value = '';
  }
};

const generateQrCode = async (text) => {
  if (!text) return;
  try {
    qrCodeUrl.value = await QRCode.toDataURL(text);
  } catch (err) {
    console.error('生成二维码失败', err);
    qrCodeUrl.value = '';
  }
};

const toggleQrCode = () => {
  showQrCode.value = !showQrCode.value;
};

watch(allRegisters, () => {
  if (!isShowingHistory.value) {
    resetToDefault();
  }
}, { deep: true });

const formatUpdateTime = (updateTime) => {
  if (!updateTime) return '';
  const date = new Date(updateTime);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

const getLatestUpdateTime = (registerList) => {
  if (!registerList || registerList.length === 0) return null;
  let latestTime = null;
  for (const item of registerList) {
    if (item.updateTime) {
      const time = new Date(item.updateTime);
      if (!latestTime || time > latestTime) latestTime = time;
    }
  }
  return latestTime;
};

const shouldAutoRefresh = () => {
  if (!serverUpdateTime.value) return true;
  const now = new Date();
  const lastUpdate = new Date(serverUpdateTime.value);
  return (now - lastUpdate) <= MAX_UPDATE_INTERVAL;
};

const getAttendanceTypeText = (type) => {
  const typeMap = { 1: '传统考勤', 4: '动态二维码考勤' };
  return typeMap[type] || '数字考勤';
};

const getStatusText = (item) => {
  const status = item.registerStatus;
  if (!isFinishedStatus(status)) return '未签到';
  const map = { '0': '出勤', '1': '迟到', '2': '旷课', '3': '早退', '4': '事假', '5': '病假' };
  return map[status] || '未知';
};

const getStatusClass = (item) => {
  const status = item.registerStatus;
  if (!isFinishedStatus(status)) return 'status-unknown';
  const map = {
    '0': 'status-present',
    '1': 'status-late',
    '2': 'status-absent',
    '3': 'status-leave-early',
    '4': 'status-leave',
    '5': 'status-sick'
  };
  return map[status] || 'status-unknown';
};

// 获取平台凭据
const fetchPlatformCredentials = async () => {
  try {
    const response = await request.get('/auth/platform-credentials');
    if (response.success && response.data.hasCredentials) {
      platformCredentials.value = {
        studentId: response.data.studentId,
        encryptedPassword: response.data.encryptedPassword
      };
      return true;
    } else {
      showFailToast(response.message || '未绑定平台账号，请先在个人中心绑定');
      return false;
    }
  } catch (error) {
    console.error('获取平台凭据失败:', error);
    showFailToast('获取平台账号信息失败，请先登录系统');
    return false;
  }
};

// 登录成功回调
const onLoginSuccess = async () => {
  isLoggedIn.value = true;
  showSuccessToast('登录成功');
  // 登录后重新加载数据
  await fetchRegisterList(false);
  startAutoRefresh();
};

// 登录失败回调
const onLoginFail = (data) => {
  showFailToast(data.message || '登录失败');
};

// 打开登录弹窗（用户主动点击）
const openLoginDialog = async () => {
  const hasCredentials = await fetchPlatformCredentials();
  if (!hasCredentials) return;
  showLoginDialog.value = true;
};

// 检查本地登录
const checkLocalLogin = () => {
  if (zhktApi.checkLocalLogin()) {
    isLoggedIn.value = true;
    return true;
  }
  return false;
};

// 自动刷新控制
const startAutoRefresh = () => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(async () => {
    if (shouldAutoRefresh() && isLoggedIn.value) {
      await fetchRegisterList(false);
    }
  }, AUTO_REFRESH_INTERVAL);
};

const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
};


// 获取考勤列表（使用通用API）
let loginExpiredToastShown = false; // 防止重复提示

const fetchRegisterList = async (isManual = false) => {
  if (!isLoggedIn.value) {
    if (isManual) showFailToast('请先登录智慧教育平台');
    return;
  }

  if (!courseTeacherId.value) {
    showFailToast('课程信息缺失');
    goBack();
    return;
  }

  if (!isManual) {
    loading.value = true;
    showLoadingToast({ message: '加载中...', forbidClick: true });
  }

  try {
    const result = await zhktApi.get('/course/find/register/list', {
      courseTeacherId: courseTeacherId.value,
      teacherNo: teacherNo.value
    });

    if (result.success && result.data?.registerList) {
      const sortedList = [...result.data.registerList].sort((a, b) =>
        new Date(b.updateTime || b.createTime) - new Date(a.updateTime || a.createTime)
      );
      allRegisters.value = sortedList;
      historyList.value = sortedList;

      const latestTime = getLatestUpdateTime(sortedList);
      if (latestTime) {
        serverUpdateTime.value = latestTime.toISOString();
        lastUpdateTime.value = formatUpdateTime(serverUpdateTime.value);
      }

      if (isManual) showSuccessToast('刷新成功');
    }
    else if (result.needLogin) {
      // 登录过期或密钥异常 - 不自动弹窗，只提示一次
      isLoggedIn.value = false;
      zhktApi.logout();
      if (!loginExpiredToastShown) {
        loginExpiredToastShown = true;
        showFailToast('登录已过期，请点击"立即登录"重新登录');
        setTimeout(() => { loginExpiredToastShown = false; }, 3000);
      }
      // 可选：不清空已有数据，让用户手动登录后刷新
    }
    else if (!result.success) {
      showFailToast(result.message || '获取考勤数据失败');
    }
  } catch (error) {
    console.error('获取考勤列表失败:', error);
    showFailToast(isManual ? '刷新失败，请稍后重试' : '获取考勤数据失败');
  } finally {
    if (!isManual) {
      loading.value = false;
      closeToast();
    }
  }
};

const manualRefresh = async () => {
  if (manualRefreshing.value) return;
  manualRefreshing.value = true;
  showLoadingToast({ message: '刷新中...', forbidClick: true });
  await fetchRegisterList(true);
  manualRefreshing.value = false;
  closeToast();
};

// 执行考勤
const handleDoRegister = async () => {
  if (!isLoggedIn.value) {
    showFailToast('请先登录智慧教育平台');
    openLoginDialog();
    return;
  }

  if (!activeRegister.value) return;

  if (isActiveCompleted.value) {
    showFailToast('该考勤已完成，无需重复签到');
    return;
  }

  const { registerStudentId, registerKey } = activeRegister.value;
  if (!registerStudentId || !registerKey) {
    showFailToast('考勤信息不完整');
    return;
  }

  submitting.value = true;
  showLoadingToast({ message: '考勤中...', forbidClick: true });

  try {
    // 按照原请求格式：id=xxx&key=xxx
    const result = await zhktApi.post('/course/update/student/register', {
      id: registerStudentId,
      key: registerKey
    });

    if (result.success) {
      showSuccessToast('考勤成功！');
      await fetchRegisterList(false);
    } else if (result.needLogin) {
      isLoggedIn.value = false;
      zhktApi.logout();
      showFailToast('登录已过期，请重新登录');
      openLoginDialog();
    } else {
      showFailToast(result.message || '考勤失败');
    }
  } catch (error) {
    console.error('考勤失败:', error);
    showFailToast('考勤失败，请稍后重试');
  } finally {
    submitting.value = false;
    closeToast();
  }
};

const goBack = () => {
  router.back();
};

onMounted(async () => {
  closeToast(); // 清除可能的残留提示
  if (checkLocalLogin()) {
    await fetchRegisterList(false);
    startAutoRefresh();
  } else {
    const hasCredentials = await fetchPlatformCredentials();
    if (hasCredentials) {
      isLoggedIn.value = false;
    }
  }
});

onBeforeUnmount(() => {
  stopAutoRefresh();
});
</script>

<style scoped lang="scss">
.attendance-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(145deg, #eef2f9 0%, #f8fafc 100%);
  overflow: hidden;
}

/* 顶部导航栏 - 玻璃 */
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
  position: relative;
  z-index: 10;

  .van-icon {
    font-size: 22px;
    cursor: pointer;
    color: #1e293b;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
    transition: all 0.2s;
    &:active {
      transform: scale(0.92);
    }
  }

  .refreshing {
    animation: rotate 0.5s linear infinite;
  }

  .title {
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 登录提示 - 玻璃面板 */
.login-tip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px;
  margin: 20px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  border-radius: 48px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);

  .van-icon {
    margin-bottom: 20px;
    opacity: 0.8;
  }

  p {
    font-size: 16px;
    font-weight: 500;
    color: #1e293b;
    margin-bottom: 30px;
  }

  .van-button {
    width: 200px;
    background: rgba(30, 41, 59, 0.85);
    backdrop-filter: blur(8px);
    border: none;
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
    &:active {
      transform: scale(0.97);
    }
  }
}

/* 当前考勤区域容器 */
.current-section {
  flex-shrink: 0;
  padding: 0 0 8px 0;
}

/* 当前考勤卡片 - 玻璃 + 高光 */
.current-card {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  margin: 16px 16px 8px 16px;
  padding: 24px 20px;
  border-radius: 36px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  text-align: center;
  position: relative;
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
    border-radius: 36px 36px 0 0;
    pointer-events: none;
    z-index: 1;
  }

  .label {
    font-size: 14px;
    font-weight: 600;
    color: #475569;
    letter-spacing: 1px;
    margin-bottom: 12px;
    position: relative;
    z-index: 2;
  }

  .code-area {
    margin: 12px 0;
    position: relative;
    z-index: 2;
  }

  .big-code {
    font-size: 56px;
    font-weight: 800;
    font-family: monospace;
    color: #0f172a;
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(4px);
    display: inline-block;
    padding: 8px 24px;
    border-radius: 60px;
    letter-spacing: 6px;
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }

  .qrcode-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .qrcode-img {
    width: 200px;
    height: 200px;
    margin: 0 auto;
    border-radius: 16px;
    background: white;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .qrcode-tip {
    font-size: 12px;
    color: #475569;
    margin-top: 8px;
  }

  .course-name {
    font-size: 14px;
    font-weight: 500;
    color: #334155;
    margin-bottom: 24px;
    position: relative;
    z-index: 2;
  }

  .attendance-type {
    margin-bottom: 16px;
    position: relative;
    z-index: 2;
  }

  .button-group {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    position: relative;
    z-index: 2;
  }

  .black-btn {
    background: rgba(30, 41, 59, 0.85);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    height: 44px;
    font-weight: 600;
    color: white;
    flex: 1;
    border-radius: 40px;
    transition: all 0.2s;
    &:active {
      transform: scale(0.96);
      background: rgba(30, 41, 59, 0.95);
    }
    &.outline {
      background: transparent;
      border: 1px solid rgba(30, 41, 59, 0.7);
      color: #1e293b;
      &:active {
        background: rgba(30, 41, 59, 0.1);
      }
    }
  }

  .back-default {
    margin-top: 12px;
    font-size: 12px;
    color: #1e293b;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.3);
    padding: 6px 12px;
    border-radius: 30px;
    backdrop-filter: blur(4px);
    transition: all 0.2s;
    &:active {
      transform: scale(0.96);
      background: rgba(255, 255, 255, 0.5);
    }
  }
}

/* 空状态 / 无考勤提示 - 玻璃卡片 */
.no-attendance,
.no-current-tip {
  text-align: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(16px);
  margin: 16px;
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);

  .van-icon {
    margin-bottom: 8px;
    opacity: 0.7;
  }

  p {
    font-size: 14px;
    font-weight: 500;
    color: #334155;
  }

  .sub-tip {
    font-size: 12px;
    color: #64748b;
    margin-top: 4px;
  }
}

/* 历史考勤区域 */
.history-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 0 16px;

  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    margin: 8px 0 12px;
    padding-left: 8px;
    border-left: 4px solid #1e293b;
    flex-shrink: 0;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);

    .update-time {
      font-size: 11px;
      font-weight: normal;
      color: #475569;
      background: rgba(255, 255, 255, 0.3);
      padding: 2px 8px;
      border-radius: 20px;
    }
  }
}

.history-list-container {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 20px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 历史考勤卡片 - 玻璃 + 高光 */
.history-item {
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(16px);
  border-radius: 24px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 40%;
    background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 100%);
    border-radius: 24px 24px 0 0;
    pointer-events: none;
  }

  &:active {
    transform: scale(0.98);
    background: rgba(255, 255, 255, 0.35);
  }

  &.active-item {
    border: 2px solid #1e293b;
    background: rgba(255, 255, 255, 0.3);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  }

  .item-name {
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 8px;
    font-size: 15px;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
  }

  .item-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 8px;

    .status-badge {
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.5);
    }

    .status-present {
      background: rgba(21, 128, 61, 0.15);
      color: #15803d;
    }
    .status-absent {
      background: rgba(185, 28, 28, 0.15);
      color: #b91c1c;
    }
    .status-late,
    .status-leave-early {
      background: rgba(245, 63, 63, 0.2);
      color: #b91c1c;
    }
    .status-leave,
    .status-sick {
      background: rgba(29, 78, 216, 0.15);
      color: #1d4ed8;
    }
    .status-unknown {
      background: rgba(71, 85, 105, 0.2);
      color: #334155;
    }
  }

  .item-detail {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    font-weight: 500;
    color: #475569;
    margin-top: 4px;

    .attendance-type-text {
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(4px);
      padding: 2px 8px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.6);
    }
  }
}
</style>