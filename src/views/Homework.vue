<template>
  <div class="homework-page">
    <!-- 固定顶部区域 -->
    <div class="fixed-top">
      <div class="search-bar">
        <van-search v-model="searchKeyword" placeholder="搜索作业名称" shape="round" background="transparent"
          @search="onSearch" @clear="onClear" />
      </div>

      <!-- 课程区域：网格布局 + 更多按钮 -->
      <div class="courses-section">
        <div class="courses-header">
          <span class="section-title">{{ activeTab === 'my' ? '我的课程' : (activeTab === 'platform' ? '平台课程' : '')
          }}</span>
          <div class="expand-btn" @click="toggleExpand" v-if="allCourseList.length > DEFAULT_DISPLAY_COUNT">
            <van-icon :name="expandAllCourses ? 'arrow-up' : 'arrow-down'" />
            <span>{{ expandAllCourses ? '收起' : '展开' }}</span>
          </div>
        </div>
        <div class="courses-grid" :class="{ expanded: expandAllCourses }">
          <template v-for="course in displayCourseList" :key="course.id">
            <div class="course-tab" :class="{ active: selectedCourseId === course.id }" @click="selectCourse(course)">
              <span class="course-name">{{ course.name }}</span>
              <span v-if="course.homework_count > 0 && activeTab === 'my'" class="homework-badge">
                {{ course.homework_count }}
              </span>
            </div>
          </template>
          <div v-if="!expandAllCourses && allCourseList.length > DEFAULT_DISPLAY_COUNT" class="more-card"
            @click="toggleExpand">
            <span class="more-text">...</span>
          </div>
        </div>
      </div>

      <!-- 选项卡 -->
      <div class="tab-bar">
        <div class="tab-item" :class="{ active: activeTab === 'my' }" @click="switchTab('my')">
          <span>我的作业</span>
        </div>
        <div class="tab-item" :class="{ active: activeTab === 'platform' }" @click="switchTab('platform')">
          <span>平台作业</span>
        </div>
        <div class="tab-item" :class="{ active: activeTab === 'platform-notice' }"
          @click="switchTab('platform-notice')">
          <span>平台消息</span>
        </div>
      </div>
    </div>

    <!-- 未登录提示（平台作业/平台消息） -->
    <div v-if="(activeTab === 'platform' || activeTab === 'platform-notice') && !isLoggedIn" class="login-tip">
      <van-icon name="info-o" size="48" color="#1e293b" />
      <p>请先登录智慧教育平台</p>
      <van-button type="primary" round @click="openLoginDialog">立即登录</van-button>
    </div>

    <!-- 作业列表区域 -->
    <div class="homework-scroll-wrapper" v-else>
      <div class="homework-wrapper">
        <div class="homework-header">
          <div class="title-section">
            <span class="homework-title">{{ getTabStr() }}</span>
            <span class="homework-count" v-if="activeTab === 'my' && selectedCourseId">
              共 {{ filteredHomeworks.length }} 个
            </span>
            <span class="homework-count" v-if="activeTab === 'platform' && selectedCourseId">
              共 {{ filteredPlatformHomeworks.length }} 个
            </span>
            <span class="homework-count" v-if="activeTab === 'platform-notice'">
              共 {{ filteredPlatformNotices.length }} 条
            </span>
          </div>
          <div class="refresh-btn" @click="refreshCurrentData" :class="{ refreshing: manualRefreshing }"
            v-if="(activeTab === 'my' && selectedCourseId) || (activeTab === 'platform' && isLoggedIn && selectedCourseId) || (activeTab === 'platform-notice' && isLoggedIn)">
            <van-icon name="replay" />
            <span>刷新</span>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loadingData" class="loading-tip">
          <van-loading size="24" /> 加载中...
        </div>

        <!-- 未选择课程提示（我的作业和平台作业） -->
        <div v-else-if="(activeTab === 'my' || activeTab === 'platform') && !selectedCourseId && !loadingCourses"
          class="select-hint">
          <van-icon name="records-o" size="48" color="#94a3b8" />
          <p>请先选择一门课程</p>
        </div>

        <!-- 我的作业列表 -->
        <template v-else-if="activeTab === 'my'">
          <div v-if="filteredHomeworks.length > 0">
            <div class="homework-category" v-if="incompleteHomeworks.length > 0">
              <div class="category-header">
                <van-icon name="warning-o" />
                <span>未完成</span>
                <span class="category-count">{{ incompleteHomeworks.length }}</span>
              </div>
              <div class="homework-list">
                <div v-for="homework in incompleteHomeworks" :key="homework.id" class="homework-card"
                  @click="goToHomeworkDetail(homework)">
                  <div class="card-content">
                    <div class="homework-name">{{ homework.name }}</div>
                    <div class="homework-time">
                      <van-icon name="clock-o" />
                      <span>截止：{{ formatDate(homework.finish_time) }}</span>
                    </div>
                    <div class="homework-tag">
                      <van-tag type="warning" size="small">未完成</van-tag>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="homework-category" v-if="completedHomeworks.length > 0">
              <div class="category-header">
                <van-icon name="completed" />
                <span>已完成</span>
                <span class="category-count">{{ completedHomeworks.length }}</span>
              </div>
              <div class="homework-list">
                <div v-for="homework in completedHomeworks" :key="homework.id" class="homework-card completed"
                  @click="goToHomeworkDetail(homework)">
                  <div class="card-content">
                    <div class="homework-name">{{ homework.name }}</div>
                    <div class="homework-time">
                      <van-icon name="clock-o" />
                      <span>截止：{{ formatDate(homework.finish_time) }}</span>
                    </div>
                    <div class="homework-score" v-if="homework.score !== null">
                      得分：{{ homework.score }} / {{ homework.total_score }}
                    </div>
                    <div class="homework-tag">
                      <van-tag type="success" size="small">已完成</van-tag>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <van-empty v-else-if="selectedCourseId && filteredHomeworks.length === 0 && !loadingData" description="暂无作业"
            :image-size="80" />
        </template>

        <!-- 平台作业列表 -->
        <template v-else-if="activeTab === 'platform'">
          <div v-if="filteredPlatformHomeworks.length > 0">
            <div class="homework-list platform-list">
              <div v-for="homework in filteredPlatformHomeworks" :key="homework.id" class="homework-card platform-card"
                @click="goToPlatformHomework(homework)">
                <div class="card-content">
                  <div class="homework-title-row">
                    <span class="homework-name">{{ homework.name }}</span>
                    <van-tag v-if="homework.pushType === 'GROUP'" type="primary" size="small" round>小组作业</van-tag>
                  </div>
                  <div class="homework-course">{{ homework.courseName }}</div>
                  <div class="homework-teacher">
                    <van-icon name="manager-o" />
                    <span>{{ homework.teacherName }}</span>
                  </div>
                  <div class="homework-time" :class="{ expired: isExpired(homework.finishTime) }">
                    <van-icon name="clock-o" />
                    <span>截止：{{ formatDateTime(homework.finishTime) }}</span>
                    <van-tag v-if="isExpired(homework.finishTime)" type="danger" size="mini" round>已过期</van-tag>
                  </div>
                  <div class="homework-answer-time" v-if="homework.answerTime">
                    <van-icon name="clock-o" />
                    <span>已保存- 作答用时：{{ formatAnswerTime(homework.answerTime) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <van-empty v-else-if="selectedCourseId && filteredPlatformHomeworks.length === 0 && !loadingData"
            description="暂无平台作业" :image-size="80" />
        </template>

        <!-- 平台消息列表 -->
        <template v-else-if="activeTab === 'platform-notice'">
          <div v-if="filteredPlatformNotices.length > 0">
            <div class="notice-list">
              <div v-for="notice in filteredPlatformNotices" :key="notice.id" class="notice-card"
                @click="showNoticeDetail(notice)">
                <div class="notice-header">
                  <div class="notice-title-row">
                    <van-icon :name="getNoticeIcon(notice.noticeType)" class="notice-icon"
                      :class="getNoticeIconClass(notice.noticeType)" />
                    <span class="notice-title">{{ notice.title }}</span>
                  </div>
                  <span class="notice-time">{{ formatDateTime(notice.pushTime) }}</span>
                </div>
                <div class="notice-content" v-html="getShortContent(notice.content)"></div>
                <div class="notice-footer">
                  <span class="notice-teacher">
                    <van-icon name="manager-o" />
                    {{ notice.teacherName }}
                  </span>
                  <span v-if="notice.courseId" class="notice-course">
                    <van-icon name="shop-o" />
                    {{ extractCourseName(notice.content) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <van-empty v-else-if="filteredPlatformNotices.length === 0 && !loadingNotices" description="暂无平台消息"
            :image-size="80" />

          <!-- 加载更多 -->
          <div v-if="hasMoreNotices && !loadingNotices && filteredPlatformNotices.length > 0" class="load-more"
            @click="loadMoreNotices">
            <span>加载更多</span>
          </div>
          <div v-if="loadingNotices" class="loading-tip">
            <van-loading size="20" /> 加载中...
          </div>
        </template>

        <div class="bottom-space"></div>
      </div>
    </div>

    <!-- 消息详情弹窗 -->
    <van-dialog v-model:show="showNoticeDialog" :title="currentNotice.title" confirm-button-text="我知道了">
      <div class="notice-detail-content">
        <div class="notice-meta">
          <span class="notice-teacher-detail">
            <van-icon name="manager-o" />
            {{ currentNotice.teacherName }}
          </span>
          <span class="notice-time-detail">
            <van-icon name="clock-o" />
            {{ formatDateTime(currentNotice.pushTime) }}
          </span>
        </div>
        <div class="notice-content-detail" v-html="currentNotice.content"></div>
      </div>
    </van-dialog>

    <!-- 登录弹窗 - 使用统一的组件 -->
    <ZhktLoginDialog v-model:visible="showLoginDialog" :username="platformCredentials.studentId"
      :encrypted-password="platformCredentials.encryptedPassword" @login-success="onLoginSuccess"
      @login-fail="onLoginFail" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showLoadingToast, closeToast, showSuccessToast, showFailToast } from 'vant'
import { getCoursesWithHomeworkCount, getHomeworksByCourse, getPlatformCredentials } from '@/api'
import { zhktApi } from '@/utils/zhktApi'
import ZhktLoginDialog from '@/components/ZhktLoginDialog.vue'
import dayjs from 'dayjs'

// 控制 App 层滚动
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

// 选项卡状态
const activeTab = ref('my')

// 我的作业数据
const courses = ref([])
const allHomeworks = ref([])
const selectedCourseId = ref(null)
const loadingCourses = ref(false)
const loadingHomeworks = ref(false)
const loadingPlatform = ref(false)
const manualRefreshing = ref(false)
const searchKeyword = ref('')
const lastUpdateTime = ref('')

// 平台作业数据
const platformHomeworks = ref([])
const platformCourses = ref([])

// 平台消息数据
const platformNotices = ref([])
const loadingNotices = ref(false)
const noticePageNum = ref(1)
const noticeTotalPages = ref(1)

// 消息详情弹窗
const showNoticeDialog = ref(false)
const currentNotice = ref({
  title: '',
  content: '',
  teacherName: '',
  pushTime: ''
})

// 平台登录相关
const isLoggedIn = ref(false)
const showLoginDialog = ref(false)
const platformCredentials = ref({ studentId: '', encryptedPassword: '' })

// 展开/收起控制
const expandAllCourses = ref(false)
const DEFAULT_DISPLAY_COUNT = 6

// 数据加载标记
const myCoursesLoaded = ref(false)
const myHomeworksLoaded = ref(false)
const platformLoaded = ref(false)
const currentHomeworkCourseId = ref(null)
let loginExpiredToastShown = false

// localStorage 缓存 key
const STORAGE_KEYS = {
  MY_COURSES: 'homework_my_courses',
  PLATFORM_COURSES: 'homework_platform_courses',
  PLATFORM_HOMEWORKS: 'homework_platform_homeworks',
  PLATFORM_NOTICES: 'homework_platform_notices',
  SELECTED_COURSE_ID: 'homework_selected_course_id',
  ACTIVE_TAB: 'homework_active_tab',
  PLATFORM_LAST_UPDATE: 'homework_platform_last_update'
}

// 从 localStorage 加载缓存
const loadFromStorage = () => {
  const storedCourses = localStorage.getItem(STORAGE_KEYS.MY_COURSES)
  if (storedCourses) {
    try {
      courses.value = JSON.parse(storedCourses)
      myCoursesLoaded.value = true
    } catch (e) {
      console.error('解析课程缓存失败:', e)
    }
  }

  const storedPlatformCourses = localStorage.getItem(STORAGE_KEYS.PLATFORM_COURSES)
  if (storedPlatformCourses) {
    try {
      platformCourses.value = JSON.parse(storedPlatformCourses)
    } catch (e) {
      console.error('解析平台课程缓存失败:', e)
    }
  }

  const storedPlatformHomeworks = localStorage.getItem(STORAGE_KEYS.PLATFORM_HOMEWORKS)
  if (storedPlatformHomeworks) {
    try {
      platformHomeworks.value = JSON.parse(storedPlatformHomeworks)
      platformLoaded.value = true
    } catch (e) {
      console.error('解析平台作业缓存失败:', e)
    }
  }

  const storedPlatformNotices = localStorage.getItem(STORAGE_KEYS.PLATFORM_NOTICES)
  if (storedPlatformNotices) {
    try {
      platformNotices.value = JSON.parse(storedPlatformNotices)
    } catch (e) {
      console.error('解析平台消息缓存失败:', e)
    }
  }

  const storedLastUpdate = localStorage.getItem(STORAGE_KEYS.PLATFORM_LAST_UPDATE)
  if (storedLastUpdate) {
    lastUpdateTime.value = storedLastUpdate
  }

  const storedSelectedId = localStorage.getItem(STORAGE_KEYS.SELECTED_COURSE_ID)
  if (storedSelectedId) {
    selectedCourseId.value = storedSelectedId
  }

  const storedActiveTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)
  if (storedActiveTab && (storedActiveTab === 'my' || storedActiveTab === 'platform' || storedActiveTab === 'platform-notice')) {
    activeTab.value = storedActiveTab
  }
}

// 保存到 localStorage
const saveToStorage = () => {
  if (courses.value.length > 0) {
    localStorage.setItem(STORAGE_KEYS.MY_COURSES, JSON.stringify(courses.value))
  }
  if (platformCourses.value.length > 0) {
    localStorage.setItem(STORAGE_KEYS.PLATFORM_COURSES, JSON.stringify(platformCourses.value))
  }
  if (platformHomeworks.value.length > 0) {
    localStorage.setItem(STORAGE_KEYS.PLATFORM_HOMEWORKS, JSON.stringify(platformHomeworks.value))
  }
  if (platformNotices.value.length > 0) {
    localStorage.setItem(STORAGE_KEYS.PLATFORM_NOTICES, JSON.stringify(platformNotices.value))
  }
  if (lastUpdateTime.value) {
    localStorage.setItem(STORAGE_KEYS.PLATFORM_LAST_UPDATE, lastUpdateTime.value)
  }
  if (selectedCourseId.value) {
    localStorage.setItem(STORAGE_KEYS.SELECTED_COURSE_ID, selectedCourseId.value)
  }
  localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab.value)
}

// 格式化更新时间
const formatUpdateTime = (updateTime) => {
  if (!updateTime) return ''
  const date = new Date(updateTime)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 计算加载状态
const loadingData = computed(() => {
  if (activeTab.value === 'my') return loadingHomeworks.value
  if (activeTab.value === 'platform') return loadingPlatform.value
  return loadingNotices.value
})

// 全部课程列表
const allCourseList = computed(() => {
  if (activeTab.value === 'my') {
    return courses.value
  } else if (activeTab.value === 'platform') {
    return platformCourses.value
  }
  return []
})

// 当前显示的课程列表
const displayCourseList = computed(() => {
  const list = allCourseList.value
  if (expandAllCourses.value) return list
  return list.slice(0, DEFAULT_DISPLAY_COUNT)
})

// 过滤后的平台作业（按选中课程）
const filteredPlatformHomeworks = computed(() => {
  if (!selectedCourseId.value) return []
  let list = platformHomeworks.value
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    list = list.filter(hw => hw.name?.toLowerCase().includes(keyword))
  }
  const selectedCourse = platformCourses.value.find(c => c.id === selectedCourseId.value)
  if (selectedCourse) {
    list = list.filter(hw => hw.courseName === selectedCourse.name)
  }
  return list
})

// 过滤后的我的作业
const filteredHomeworks = computed(() => {
  if (!searchKeyword.value) return allHomeworks.value
  const keyword = searchKeyword.value.toLowerCase()
  return allHomeworks.value.filter(hw => hw.name?.toLowerCase().includes(keyword))
})

// 过滤后的平台消息（支持搜索）
const filteredPlatformNotices = computed(() => {
  let list = platformNotices.value
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    list = list.filter(notice =>
      notice.title?.toLowerCase().includes(keyword) ||
      notice.content?.toLowerCase().includes(keyword) ||
      notice.teacherName?.toLowerCase().includes(keyword)
    )
  }
  // 按推送时间倒序排列
  return [...list].sort((a, b) => new Date(b.pushTime) - new Date(a.pushTime))
})

// 是否有更多消息
const hasMoreNotices = computed(() => {
  return noticePageNum.value < noticeTotalPages.value
})

// 已完成/未完成（我的作业）
const completedHomeworks = computed(() => {
  return filteredHomeworks.value.filter(hw => hw.is_completed === true)
})

const incompleteHomeworks = computed(() => {
  return filteredHomeworks.value.filter(hw => hw.is_completed !== true)
})

// 格式化日期
const formatDate = (date) => {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const formatDateTime = (date) => {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

// 格式化作答时间（秒 -> 分钟:秒）
const formatAnswerTime = (seconds) => {
  if (!seconds && seconds !== 0) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}分${secs}秒`
  }
  return `${secs}秒`
}

// 判断作业是否过期
const isExpired = (finishTime) => {
  if (!finishTime) return false
  return dayjs().isAfter(dayjs(finishTime))
}

// 获取消息类型图标
const getNoticeIcon = (noticeType) => {
  const icons = {
    '0': 'bell-o',      // 通知公告
    '1': 'edit',        // 作业任务
    '2': 'todo-list-o', // 学习任务
    '3': 'passed',      // 成绩通知
    '4': 'clock-o'      // 课中任务
  }
  return icons[noticeType] || 'notes-o'
}

// 获取消息类型图标样式
const getNoticeIconClass = (noticeType) => {
  const classes = {
    '0': 'icon-bell',
    '1': 'icon-homework',
    '2': 'icon-task',
    '3': 'icon-score',
    '4': 'icon-class'
  }
  return classes[noticeType] || 'icon-default'
}

// 获取简短内容（去除HTML标签，限制长度）
const getShortContent = (content) => {
  if (!content) return ''
  // 去除HTML标签
  let text = content.replace(/<[^>]*>/g, '')
  // 去除<br/>标签
  text = text.replace(/<br\s*\/?>/g, ' ')
  // 限制长度
  if (text.length > 80) {
    return text.substring(0, 80) + '...'
  }
  return text
}

// 从content中提取课程名称
const extractCourseName = (content) => {
  if (!content) return ''
  const match = content.match(/课程[：:]\s*《([^》]+)》/)
  if (match) return match[1]
  return ''
}

// 显示消息详情弹窗
const showNoticeDetail = (notice) => {
  currentNotice.value = {
    title: notice.title,
    content: notice.content,
    teacherName: notice.teacherName,
    pushTime: notice.pushTime
  }
  showNoticeDialog.value = true
}

// 切换展开/收起
const toggleExpand = () => {
  expandAllCourses.value = !expandAllCourses.value
}

// 切换选项卡
const switchTab = async (tab) => {
  if (activeTab.value === tab) return
  activeTab.value = tab
  searchKeyword.value = ''
  expandAllCourses.value = false
  saveToStorage()

  if (tab === 'platform') {
    if (isLoggedIn.value) {
      if (platformHomeworks.value.length === 0 && !platformLoaded.value && !loadingPlatform.value) {
        await fetchPlatformHomeworks()
      }
    }
    if (platformCourses.value.length > 0 && !selectedCourseId.value) {
      selectedCourseId.value = platformCourses.value[0].id
      saveToStorage()
    }
  } else if (tab === 'my') {
    if (courses.value.length > 0 && !selectedCourseId.value) {
      selectCourse(courses.value[0])
    }
  } else if (tab === 'platform-notice') {
    if (isLoggedIn.value) {
      if (platformNotices.value.length === 0 && !loadingNotices.value) {
        await fetchPlatformNotices(false)
      }
    }
  }
}

// 选择课程
const selectCourse = async (course) => {
  if (selectedCourseId.value === course.id) return
  selectedCourseId.value = course.id
  saveToStorage()

  if (activeTab.value === 'my') {
    if (currentHomeworkCourseId.value !== course.id || !myHomeworksLoaded.value) {
      await fetchHomeworks(course.id, true)
      currentHomeworkCourseId.value = course.id
      myHomeworksLoaded.value = true
    }
  }
}

// ========== 平台登录相关方法 ==========
const fetchPlatformCredentials = async () => {
  try {
    const response = await getPlatformCredentials()
    if (response.success && response.data.hasCredentials) {
      platformCredentials.value = {
        studentId: response.data.studentId,
        encryptedPassword: response.data.encryptedPassword
      }
      return true
    } else {
      showFailToast(response.message || '未绑定平台账号，请先在个人中心绑定')
      return false
    }
  } catch (error) {
    console.error('获取平台凭据失败:', error)
    showFailToast('获取平台账号信息失败，请先登录系统')
    return false
  }
}

// 登录成功回调
const onLoginSuccess = async () => {
  isLoggedIn.value = true
  showSuccessToast('登录成功')

  const res = await getPlatformCredentials()
  if (res.success && res.data.hasCredentials) {
    platformCredentials.value = {
      studentId: res.data.studentId,
      encryptedPassword: res.data.encryptedPassword
    }
  }

  // 根据当前选项卡刷新数据
  if (activeTab.value === 'platform') {
    platformLoaded.value = false
    await fetchPlatformHomeworks(true)
  } else if (activeTab.value === 'platform-notice') {
    await fetchPlatformNotices(false)
  }
}

// 登录失败回调
const onLoginFail = (data) => {
  showFailToast(data.message || '登录失败')
}

// 打开登录弹窗
const openLoginDialog = async () => {
  const hasCredentials = await fetchPlatformCredentials()
  if (!hasCredentials) return

  if (!platformCredentials.value.studentId) {
    showFailToast('未获取到学号信息')
    return
  }

  showLoginDialog.value = true
}

// 检查本地登录
const checkLocalLogin = () => {
  if (zhktApi.checkLocalLogin()) {
    isLoggedIn.value = true
    return true
  }
  return false
}

// ========== 我的作业相关方法 ==========
const fetchCourses = async (forceRefresh = false) => {
  if (!forceRefresh && myCoursesLoaded.value && courses.value.length > 0) {
    return
  }

  loadingCourses.value = true
  try {
    const res = await getCoursesWithHomeworkCount()
    if (res.success) {
      courses.value = res.data || []
      myCoursesLoaded.value = true
      saveToStorage()

      if (courses.value.length > 0 && !selectedCourseId.value && activeTab.value === 'my') {
        selectCourse(courses.value[0])
      }
    } else {
      showToast({ message: res.message || '获取课程失败', type: 'fail' })
    }
  } catch (error) {
    console.error('获取课程失败:', error)
    showToast({ message: '获取课程失败', type: 'fail' })
  } finally {
    loadingCourses.value = false
  }
}

const fetchHomeworks = async (courseId, showLoad = false, forceRefresh = false) => {
  if (!courseId) return

  if (!forceRefresh && currentHomeworkCourseId.value === courseId && myHomeworksLoaded.value) {
    return
  }

  if (showLoad) {
    showLoadingToast({ message: '加载中...', forbidClick: true })
  }
  loadingHomeworks.value = true
  try {
    const res = await getHomeworksByCourse(courseId)
    if (res.success) {
      allHomeworks.value = res.data || []
      myHomeworksLoaded.value = true
      currentHomeworkCourseId.value = courseId
      saveToStorage()
    } else {
      showToast({ message: res.message || '获取作业失败', type: 'fail' })
      allHomeworks.value = []
    }
  } catch (error) {
    console.error('获取作业失败:', error)
    showToast({ message: '获取作业失败', type: 'fail' })
    allHomeworks.value = []
  } finally {
    loadingHomeworks.value = false
    if (showLoad) closeToast()
  }
}

// 获取平台消息列表
const fetchPlatformNotices = async (isLoadMore = false) => {
  if (!isLoggedIn.value) {
    if (!isLoadMore) showFailToast('请先登录智慧教育平台')
    return
  }

  if (isLoadMore) {
    if (!hasMoreNotices.value) return
    noticePageNum.value++
  } else {
    if (loadingNotices.value) return
    noticePageNum.value = 1
    if (!isLoadMore) {
      platformNotices.value = []
    }
  }

  loadingNotices.value = true

  try {
    const params = {
      pageNum: noticePageNum.value,
      pageSize: 20,
    }

    const result = await zhktApi.post('/notice/student/list', params)

    if (result.success && result.data) {
      const newList = result.data.list || []

      if (isLoadMore) {
        platformNotices.value = [...platformNotices.value, ...newList]
      } else {
        platformNotices.value = newList
      }

      noticeTotalPages.value = result.data.pages || 1

      if (!isLoadMore && platformNotices.value.length > 0) {
        saveToStorage()
      }
    } else if (result.needLogin) {
      isLoggedIn.value = false
      zhktApi.logout()
      if (!loginExpiredToastShown) {
        loginExpiredToastShown = true
        showFailToast('登录已过期，请点击"立即登录"重新登录')
        setTimeout(() => { loginExpiredToastShown = false }, 3000)
      }
      platformNotices.value = []
    } else {
      if (!isLoadMore) {
        showFailToast(result.message || '获取平台消息失败')
      }
    }
  } catch (error) {
    console.error('获取平台消息失败:', error)
    if (!isLoadMore) {
      showFailToast('获取平台消息失败')
    }
  } finally {
    loadingNotices.value = false
  }
}

// 加载更多消息
const loadMoreNotices = () => {
  if (!loadingNotices.value && hasMoreNotices.value) {
    fetchPlatformNotices(true)
  }
}

const getTabStr = () => {
  if (activeTab.value === 'my') return '作业列表'
  if (activeTab.value === 'platform') return '平台作业列表'
  if (activeTab.value === 'platform-notice') return '平台消息'
  return ''
}

// 获取平台作业列表
const fetchPlatformHomeworks = async (forceRefresh = false) => {
  if (!isLoggedIn.value) {
    if (forceRefresh) showFailToast('请先登录智慧教育平台')
    return
  }

  if (!forceRefresh && platformLoaded.value && platformHomeworks.value.length > 0) {
    return
  }

  if (forceRefresh) {
    showLoadingToast({ message: '加载中...', forbidClick: true })
  }
  loadingPlatform.value = true

  try {
    let studentId = platformCredentials.value.studentId
    if (!studentId) {
      const res = await getPlatformCredentials()
      if (res.success && res.data.hasCredentials) {
        studentId = res.data.studentId
        platformCredentials.value = {
          studentId: res.data.studentId,
          encryptedPassword: res.data.encryptedPassword
        }
      }
    }

    if (!studentId) {
      throw new Error('无法获取学生ID')
    }

    const params = {
      pageNum: 1,
      pageSize: 50,
      status: 1,
      studentId: studentId
    }

    const result = await zhktApi.get('/homework/list/v2', params)

    if (result.success && result.data) {
      const rawList = result.data.list || []
      platformHomeworks.value = rawList.map(item => ({
        id: item.id,
        homeworkId: item.homeworkId,
        name: item.name,
        courseName: item.courseName,
        teacherName: item.teacherName,
        finishTime: item.finishTime,
        pushTime: item.pushTime,
        pushType: item.pushType,
        answerTime: item.answerTime,
        status: item.status
      }))

      lastUpdateTime.value = formatUpdateTime(new Date().toISOString())
      saveToStorage()

      const courseMap = new Map()
      platformHomeworks.value.forEach(hw => {
        if (hw.courseName && !courseMap.has(hw.courseName)) {
          courseMap.set(hw.courseName, {
            id: hw.courseName,
            name: hw.courseName,
            homework_count: 0
          })
        }
      })
      platformCourses.value = Array.from(courseMap.values())
      platformLoaded.value = true
      saveToStorage()

      if (platformCourses.value.length > 0 && !selectedCourseId.value && activeTab.value === 'platform') {
        selectedCourseId.value = platformCourses.value[0].id
        saveToStorage()
      }

      if (forceRefresh) {
        showSuccessToast('刷新成功')
      }
    } else if (result.needLogin) {
      isLoggedIn.value = false
      zhktApi.logout()
      if (!loginExpiredToastShown) {
        loginExpiredToastShown = true
        showFailToast('登录已过期，请点击"立即登录"重新登录')
        setTimeout(() => { loginExpiredToastShown = false }, 3000)
      }
      platformHomeworks.value = []
      platformCourses.value = []
    } else {
      showFailToast(result.message || '获取平台作业失败')
      platformHomeworks.value = []
    }
  } catch (error) {
    console.error('获取平台作业失败:', error)
    showFailToast('获取平台作业失败')
    platformHomeworks.value = []
  } finally {
    loadingPlatform.value = false
    if (forceRefresh) closeToast()
  }
}

const refreshCurrentData = async () => {
  if (manualRefreshing.value) return
  manualRefreshing.value = true
  showLoadingToast({ message: '刷新中...', forbidClick: true })

  if (activeTab.value === 'my' && selectedCourseId.value) {
    myHomeworksLoaded.value = false
    await fetchHomeworks(selectedCourseId.value, false, true)
    myCoursesLoaded.value = false
    await fetchCourses(true)
    saveToStorage()
    showSuccessToast('刷新成功')
  } else if (activeTab.value === 'platform' && isLoggedIn.value) {
    platformLoaded.value = false
    await fetchPlatformHomeworks(true)
    saveToStorage()
    showSuccessToast('刷新成功')
  } else if (activeTab.value === 'platform-notice' && isLoggedIn.value) {
    await fetchPlatformNotices(false)
    showSuccessToast('刷新成功')
  }

  manualRefreshing.value = false
  closeToast()
}

const onSearch = () => { }
const onClear = () => {
  searchKeyword.value = ''
}

const goToHomeworkDetail = (homework) => {
  router.push({
    path: '/homework-detail',
    query: { homeworkId: homework.homework_id }
  })
}

const goToPlatformHomework = (homework) => {
  router.push({
    path: '/platform-homework-detail',
    query: {
      homeworkId: homework.homeworkId,
      id: homework.id,
      name: homework.name,
      courseName: homework.courseName,
      teacherName: homework.teacherName,
      finishTime: homework.finishTime,
      pushTime: homework.pushTime,
      answerTime: homework.answerTime
    }
  })
}

onActivated(() => { })

onDeactivated(() => {
  saveToStorage()
})

onMounted(async () => {
  disableAppScroll()
  closeToast()
  loadFromStorage()
  checkLocalLogin()

  if (activeTab.value === 'my') {
    if (!myCoursesLoaded.value || courses.value.length === 0) {
      await fetchCourses(false)
    } else if (courses.value.length > 0 && !selectedCourseId.value) {
      selectCourse(courses.value[0])
    } else if (selectedCourseId.value && (!myHomeworksLoaded.value || currentHomeworkCourseId.value !== selectedCourseId.value)) {
      await fetchHomeworks(selectedCourseId.value, true)
    }
  } else if (activeTab.value === 'platform') {
    if (isLoggedIn.value) {
      if (!platformLoaded.value || platformHomeworks.value.length === 0) {
        await fetchPlatformHomeworks(false)
      } else if (platformCourses.value.length > 0 && !selectedCourseId.value) {
        selectedCourseId.value = platformCourses.value[0].id
        saveToStorage()
      }
    }
  } else if (activeTab.value === 'platform-notice') {
    if (isLoggedIn.value) {
      if (platformNotices.value.length === 0 && !loadingNotices.value) {
        await fetchPlatformNotices(false)
      }
    }
  }
})
</script>

<style scoped lang="scss">
.homework-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  //  height: 100%;
  background: linear-gradient(145deg, #eef2f9 0%, #f8fafc 100%);
  overflow: hidden;
}

.fixed-top {
  position: sticky;
  top: 0;
  /* 新增，使粘性定位生效 */
  flex-shrink: 0;
  background: transparent;
  z-index: 100;
}

/* 搜索栏 - 玻璃 */
.search-bar {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  margin: 8px 12px;
  border-radius: 32px;
  padding: 2px 12px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.7);

  :deep(.van-search) {
    padding: 6px 0;
    background: transparent;
  }

  :deep(.van-search__content) {
    background: transparent;
  }

  :deep(.van-field__control) {
    color: #1e293b;
    font-weight: 500;

    &::placeholder {
      color: rgba(30, 41, 59, 0.6);
    }
  }
}

/* 课程区域 - 玻璃面板 */
.courses-section {
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  margin: 0 12px 12px 12px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  overflow: hidden;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.35), transparent);
    border-radius: 28px 28px 0 0;
    pointer-events: none;
    z-index: 1;
  }
}

.courses-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  position: relative;
  z-index: 2;

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
  }

  .expand-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #1a73e8;
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(8px);
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.2s;

    &:active {
      transform: scale(0.96);
      background: rgba(255, 255, 255, 0.6);
    }
  }
}

.courses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
  padding: 12px;
  max-height: 160px;
  overflow-y: auto;
  transition: max-height 0.3s ease;
  position: relative;
  z-index: 2;

  &.expanded {
    max-height: none;
    overflow-y: visible;
  }

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 4px;
  }
}

.course-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(4px);
  border-radius: 24px;
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);

  &:active {
    transform: scale(0.96);
    background: rgba(255, 255, 255, 0.6);
  }

  &.active {
    background: rgba(26, 115, 232, 0.7);
    border-color: rgba(255, 255, 255, 0.8);
    color: white;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);

    .homework-badge {
      background: rgba(255, 255, 255, 0.3);
      color: white;
    }
  }

  .course-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .homework-badge {
    background: rgba(0, 0, 0, 0.1);
    color: #1e293b;
    font-size: 10px;
    padding: 0 6px;
    border-radius: 20px;
    margin-left: 6px;
    flex-shrink: 0;
  }
}

.more-card {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(4px);
  border-radius: 24px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.5);

  &:active {
    transform: scale(0.96);
    background: rgba(255, 255, 255, 0.6);
  }

  .more-text {
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
    letter-spacing: 2px;
  }
}

/* 选项卡 - 玻璃 */
.tab-bar {
  display: flex;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(20px);
  margin: 0 12px 12px 12px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  overflow: hidden;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 30%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.3), transparent);
    pointer-events: none;
  }

  .tab-item {
    flex: 1;
    text-align: center;
    padding: 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    z-index: 2;

    &.active {
      color: #1a73e8;
      text-shadow: 0 0 2px rgba(255, 255, 255, 0.8);

      &::after {
        content: '';
        position: absolute;
        bottom: 8px;
        left: 50%;
        transform: translateX(-50%);
        width: 30px;
        height: 2px;
        background-color: #1a73e8;
        border-radius: 2px;
      }
    }

    &:active {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 20px;
    }
  }
}

/* 登录提示区域 - 玻璃 */
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
  backdrop-filter: blur(16px);
  border-radius: 36px;
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
    background: rgba(30, 41, 59, 0.8);
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

/* 作业列表滚动容器 */
.homework-scroll-wrapper {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* 作业列表主容器 - 玻璃 */
.homework-wrapper {
  margin: 0 12px 20px 12px;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(20px);
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  overflow: hidden;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.35), transparent);
    border-radius: 32px 32px 0 0;
    pointer-events: none;
    z-index: 1;
  }
}

.homework-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  position: relative;
  z-index: 2;

  .title-section {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .homework-title {
    font-size: 15px;
    font-weight: 700;
    color: #1e293b;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
  }

  .homework-count {
    font-size: 12px;
    color: #475569;
    font-weight: 500;
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(8px);
    border-radius: 30px;
    font-size: 12px;
    font-weight: 500;
    color: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s;

    &:active {
      transform: scale(0.96);
      background: rgba(255, 255, 255, 0.6);
    }

    &.refreshing {
      animation: rotate 0.5s linear infinite;
    }

    .van-icon {
      font-size: 14px;
    }
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.loading-tip,
.select-hint {
  text-align: center;
  padding: 40px;
  color: #475569;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: transparent;
}

/* 分类标题 - 保持半透明 */
.homework-category {
  margin-bottom: 8px;

  .category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(8px);
    border-radius: 20px;
    margin: 8px 12px;
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;

    .van-icon {
      font-size: 16px;
      color: #475569;
    }

    .category-count {
      background: rgba(0, 0, 0, 0.1);
      padding: 0 6px;
      border-radius: 20px;
      font-size: 11px;
      color: #1e293b;
    }
  }
}

/* 作业卡片 - 玻璃 + 高光 */
.homework-list {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.homework-card {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: all 0.25s ease;
  cursor: pointer;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 40%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.1) 100%);
    border-radius: 24px 24px 0 0;
    pointer-events: none;
  }

  &:active {
    transform: scale(0.97);
    background: rgba(255, 255, 255, 0.4);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &.completed {
    background: rgba(103, 194, 58, 0.2);
    border-color: rgba(103, 194, 58, 0.5);
  }

  .card-content {
    padding: 14px 12px;
    position: relative;
    z-index: 1;
  }

  .homework-name {
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.4;
    margin-bottom: 8px;
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.5);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .homework-time {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
    color: #475569;
    margin-bottom: 6px;

    .van-icon {
      font-size: 12px;
      color: #64748b;
    }

    &.expired {
      color: #e54545;

      .van-icon {
        color: #e54545;
      }
    }
  }

  .homework-score {
    font-size: 12px;
    font-weight: 600;
    color: #2e7d32;
    margin-bottom: 8px;
  }

  .homework-tag {
    margin-top: 4px;
  }
}

/* 平台作业卡片 - 玻璃加强 */
.platform-card {
  .homework-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .homework-name {
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.4;
    flex: 1;
    margin-bottom: 0;
  }

  .homework-course {
    font-size: 13px;
    font-weight: 600;
    color: #1a73e8;
    margin-bottom: 6px;
  }

  .homework-teacher {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
    color: #475569;
    margin-bottom: 8px;

    .van-icon {
      font-size: 12px;
      color: #64748b;
    }
  }

  .homework-answer-time {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
    color: #2e7d32;
    margin-top: 6px;

    .van-icon {
      font-size: 12px;
      color: #2e7d32;
    }
  }
}

/* 平台消息列表 - 玻璃卡片 */
.notice-list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notice-card {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  border-radius: 24px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: all 0.2s;
  cursor: pointer;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 35%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.05) 100%);
    border-radius: 24px 24px 0 0;
    pointer-events: none;
  }

  &:active {
    transform: scale(0.98);
    background: rgba(255, 255, 255, 0.4);
  }

  .notice-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;

    .notice-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;

      .notice-icon {
        font-size: 18px;
        flex-shrink: 0;
      }

      .icon-bell {
        color: #f59e0b;
      }

      .icon-homework {
        color: #10b981;
      }

      .icon-task {
        color: #3b82f6;
      }

      .icon-score {
        color: #ef4444;
      }

      .icon-class {
        color: #8b5cf6;
      }

      .icon-default {
        color: #64748b;
      }

      .notice-title {
        font-size: 15px;
        font-weight: 700;
        color: #1e293b;
        flex: 1;
        line-height: 1.4;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
      }
    }

    .notice-time {
      font-size: 11px;
      font-weight: 500;
      color: #475569;
      flex-shrink: 0;
      margin-left: 8px;
    }
  }

  .notice-content {
    font-size: 13px;
    color: #334155;
    line-height: 1.5;
    margin-bottom: 12px;
    word-break: break-word;
  }

  .notice-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 12px;
    font-weight: 500;
    color: #475569;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.5);

    .van-icon {
      font-size: 12px;
      margin-right: 2px;
    }

    .notice-teacher,
    .notice-course {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
}

/* ========== 弹窗样式：恢复默认，不玻璃 ========== */
/* 消息详情弹窗内容区域样式（弹窗背景保持默认白色） */
.notice-detail-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 16px;

  .notice-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    margin-bottom: 16px;
    border-bottom: 1px solid #eef2f6;
    font-size: 13px;
    color: #64748b;

    .notice-teacher-detail,
    .notice-time-detail {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  .notice-content-detail {
    font-size: 14px;
    color: #1e293b;
    line-height: 1.6;

    :deep(p) {
      margin: 0 0 10px 0;
    }

    :deep(table) {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;

      td,
      th {
        border: 1px solid #e2e8f0;
        padding: 6px;
      }
    }
  }
}

.load-more {
  text-align: center;
  padding: 16px;
  color: #1a73e8;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  &:active {
    opacity: 0.7;
  }
}

.bottom-space {
  height: 20px;
}
</style>