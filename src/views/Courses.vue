<template>
  <div class="courses-page">
    <!-- 固定搜索栏 - 使用 fixed 定位 -->
    <div class="fixed-search">
      <div class="search-bar">
        <van-search v-model="searchKeyword" placeholder="搜索课程名称或教师" shape="round" background="transparent"
          @search="onSearch" @clear="onClear" />
      </div>
    </div>

    <!-- 下拉刷新包裹滚动内容，并预留顶部 padding 避免被固定栏遮挡 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh" class="pull-refresh-wrapper">
      <div class="scroll-content">
        <!-- 今日课程组件 - 正常滚动 -->
        <div class="today-schedule-wrapper">
          <TodaySchedule @course-click="handleCourseClick" />
        </div>

        <!-- 公告弹窗组件 -->
        <AnnouncementPopup />

        <!-- 课程列表区域 -->
        <div class="course-wrapper">
          <!-- 标题栏 + 刷新按钮 -->
          <div class="course-header">
            <div class="title-section">
              <span class="course-title">全部课程</span>
              <span class="course-count">共 {{ courseList.length }} 门</span>
            </div>
            <div class="refresh-btn" @click="manualRefresh" :class="{ refreshing: manualRefreshing }">
              <van-icon name="replay" />
              <span>刷新</span>
            </div>
          </div>

          <!-- 加载状态 -->
          <div v-if="loading" class="loading-tip">
            <van-loading size="24" /> 加载中...
          </div>

          <!-- 无教学班提示 -->
          <div v-else-if="!hasClass && !loading" class="no-class-tip">
            <van-icon name="friends-o" size="48" color="#94a3b8" />
            <p>您还没有加入任何教学班</p>
            <p class="sub-tip">请联系管理员添加</p>
          </div>

          <!-- 课程网格 -->
          <div class="course-grid" v-else-if="courseList.length > 0">
            <div v-for="course in courseList" :key="course.id" class="course-card" @click="handleCourseClick(course)">
              <div class="card-content">
                <div class="course-name">{{ course.course_name }}</div>
                <div class="course-teacher">
                  <van-icon name="user-o" />
                  <span>{{ course.teacher_name || '未设置' }}</span>
                </div>
                <div class="course-stats">
                  <span class="students">
                    <van-icon name="friends-o" />
                    {{ course.student_num || 0 }}人
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 有教学班但无课程 -->
          <van-empty v-else-if="hasClass && courseList.length === 0 && !loading" description="暂无课程" class="empty" />

          <!-- 底部留白 -->
          <div class="bottom-space"></div>
        </div>
      </div>
    </van-pull-refresh>

    <!-- 旷课警示弹窗 -->
    <van-dialog v-model:show="showWarningDialog" title="⚠️ 温馨提示" show-cancel-button
      @confirm="confirmNavigateToAttendance" :beforeClose="beforeDialogClose">
      <div class="warning-dialog-content">
        <div class="warning-icon">
          <van-icon name="warning-o" size="48" color="#f59e0b" />
        </div>
        <div class="warning-message">{{ currentWarningMessage }}</div>
        <div class="warning-sub-message">每一次出勤，都是对未来的投资</div>
      </div>
    </van-dialog>

    <!-- 人脸识别组件 -->
    <FaceRecognition v-model="showFaceDialog" :class-id="faceClassId" :class-name="faceClassName"
      :upload-url="faceUploadUrl" @success="onFaceSuccess" @cancel="onFaceCancel" />
  </div>
</template>

<script setup>
import { ref, onMounted, onActivated, onDeactivated } from 'vue'
import { useRouter } from 'vue-router'
import { getMyCourses, getMyClasses } from '@/api'
import { showToast, showLoadingToast, closeToast, showSuccessToast, showDialog } from 'vant'
import TodaySchedule from '@/components/TodaySchedule.vue'
import AnnouncementPopup from '@/components/AnnouncementPopup.vue'
import FaceRecognition from '@/components/FaceRecognition.vue'
import request from '@/utils/request'

const router = useRouter()
const courseList = ref([])
const searchKeyword = ref('')
const refreshing = ref(false)
const manualRefreshing = ref(false)
const loading = ref(false)
const hasClass = ref(true)
const defaultClassId = ref(null)
const isDataLoaded = ref(false)
const isRequesting = ref(false)

// 旷课警示弹窗相关
const showWarningDialog = ref(false)
const currentWarningMessage = ref('')
const pendingCourse = ref(null)

// 人脸识别相关
const showFaceDialog = ref(false)
const faceClassId = ref(null)
const faceClassName = ref('')
const faceUploadUrl = ref('')
const pendingFaceCourse = ref(null)

// 旷课警示语列表
const warningMessages = [
  '侥幸逃过一次点名，逃不过期末的慌张',
  '别让一时的懒，变成毕业的难',
  '旷课看似自由，实则在透支未来',
  '一次缺席轻松，次次缺席心慌',
  '今天逃课舒服，明天补考痛苦',
  '侥幸心理一时，后悔莫及一世',
  '别让旷课，成为你掉队的开始',
  '以为躲过了点名，其实错过了重点',
  '别让安逸，耽误了你的前途',
  '每一次旷课，都是对自己的不负责',
  '逃课一时爽，期末火葬场',
  '你在宿舍睡觉，别人在课堂奔跑',
  '缺的不是课，是改变命运的机会',
  '现在的舒服，都是以后要还的债',
  '别让今天的懒惰，成为明天的遗憾'
]

// 随机获取警示语
const getRandomWarningMessage = () => {
  const randomIndex = Math.floor(Math.random() * warningMessages.length)
  return warningMessages[randomIndex]
}

// 存储教学班配置映射（class_id -> { has_permission, face_recognition_enabled }）
const classConfigMap = ref(new Map())

// 缓存 key
const STORAGE_KEYS = {
  CLASSES: 'persistent_classes',
  COURSES: 'persistent_courses',
  HAS_CLASS: 'persistent_has_class',
  CLASS_CONFIG: 'persistent_class_config'
}

// 从 localStorage 加载数据
const loadFromStorage = () => {
  const storedCourses = localStorage.getItem(STORAGE_KEYS.COURSES)
  const storedHasClass = localStorage.getItem(STORAGE_KEYS.HAS_CLASS)
  const storedClassConfig = localStorage.getItem(STORAGE_KEYS.CLASS_CONFIG)

  if (storedCourses) {
    try {
      courseList.value = JSON.parse(storedCourses)
      console.log('[课程] 从 localStorage 加载课程数据，数量:', courseList.value.length)
      return true
    } catch (e) {
      console.error('解析缓存失败:', e)
    }
  }

  if (storedHasClass !== null) {
    hasClass.value = storedHasClass === 'true'
    console.log('[教学班] 从 localStorage 加载 hasClass:', hasClass.value)
  }

  if (storedClassConfig) {
    try {
      const configArray = JSON.parse(storedClassConfig)
      classConfigMap.value = new Map(configArray)
      console.log('[配置] 从 localStorage 加载配置映射')
    } catch (e) {
      console.error('解析配置缓存失败:', e)
    }
  }

  return false
}

// 保存数据到 localStorage
const saveToStorage = (courses, hasClassValue, configMap = null) => {
  if (courses) {
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses))
  }
  if (hasClassValue !== undefined) {
    localStorage.setItem(STORAGE_KEYS.HAS_CLASS, String(hasClassValue))
  }
  if (configMap) {
    const mapArray = Array.from(configMap.entries())
    localStorage.setItem(STORAGE_KEYS.CLASS_CONFIG, JSON.stringify(mapArray))
  }
}

// 获取用户教学班并设置默认教学班ID，同时建立配置映射（权限 + 人脸识别）
const fetchMyClasses = async (forceRefresh = false) => {
  if (!forceRefresh) {
    const stored = localStorage.getItem(STORAGE_KEYS.CLASSES)
    if (stored) {
      try {
        const storedData = JSON.parse(stored)
        if (storedData && storedData.length > 0) {
          const defaultClass = storedData.find(c => c.is_default === 1)
          defaultClassId.value = defaultClass ? defaultClass.id : storedData[0].id
          hasClass.value = true

          // 建立配置映射（包含权限和人脸识别）
          classConfigMap.value.clear()
          storedData.forEach(cls => {
            classConfigMap.value.set(cls.id, {
              has_permission: cls.has_permission === 1,
              face_recognition_enabled: cls.face_recognition_enabled === 1
            })
          })
          saveToStorage(null, null, classConfigMap.value)
          console.log('[教学班] 从缓存加载，默认教学班ID:', defaultClassId.value)
          return true
        } else {
          hasClass.value = false
          return false
        }
      } catch (e) {
        console.error('解析教学班缓存失败:', e)
      }
    }
  }

  try {
    const res = await getMyClasses()
    console.log('[教学班] 响应:', res)

    if (res.success && res.data && res.data.length > 0) {
      hasClass.value = true
      const defaultClass = res.data.find(c => c.is_default === 1)
      defaultClassId.value = defaultClass ? defaultClass.id : res.data[0].id

      // 建立配置映射：class_id -> { has_permission, face_recognition_enabled }
      classConfigMap.value.clear()
      res.data.forEach(cls => {
        classConfigMap.value.set(cls.id, {
          has_permission: cls.has_permission === 1,
          face_recognition_enabled: cls.face_recognition_enabled === 1
        })
      })

      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(res.data))
      localStorage.setItem(STORAGE_KEYS.HAS_CLASS, 'true')
      saveToStorage(null, null, classConfigMap.value)
      return true
    } else {
      hasClass.value = false
      localStorage.setItem(STORAGE_KEYS.HAS_CLASS, 'false')
      localStorage.removeItem(STORAGE_KEYS.CLASSES)
      classConfigMap.value.clear()
      return false
    }
  } catch (error) {
    console.error('[教学班] 获取教学班失败:', error)
    hasClass.value = false
    return false
  }
}

// 获取课程列表
const fetchCourses = async (showLoad = false, forceRefresh = false) => {
  if (!forceRefresh && isDataLoaded.value) {
    console.log('[课程] 数据已加载，跳过请求')
    return
  }

  if (isRequesting.value) {
    console.log('[课程] 已有请求进行中，跳过')
    return
  }

  if (defaultClassId.value === null && !forceRefresh) {
    const hasClassData = await fetchMyClasses(false)
    if (!hasClassData) {
      if (showLoad) {
        loading.value = false
        closeToast()
      }
      return
    }
  } else if (forceRefresh) {
    await fetchMyClasses(true)
  }

  if (!hasClass.value) {
    if (showLoad) {
      loading.value = false
      closeToast()
    }
    return
  }

  if (showLoad && !refreshing.value && !manualRefreshing.value) {
    loading.value = true
    showLoadingToast({ message: '加载中...', forbidClick: true })
  }

  isRequesting.value = true

  try {
    const res = await getMyCourses()
    console.log('[课程] 响应:', res)

    if (res.success) {
      // 为每个课程添加配置字段（从映射中获取）
      const coursesWithConfig = (res.data || []).map(course => {
        const config = classConfigMap.value.get(course.class_id)
        return {
          ...course,
          has_permission: config?.has_permission ?? false,
          face_recognition_enabled: config?.face_recognition_enabled ?? false
        }
      })
      courseList.value = coursesWithConfig
      saveToStorage(coursesWithConfig, hasClass.value, classConfigMap.value)
      isDataLoaded.value = true

      if (forceRefresh) {
        showSuccessToast('刷新成功')
      }
    } else {
      showToast({ type: 'fail', message: res.message || '获取课程失败', duration: 3000 })
    }
  } catch (error) {
    console.error('获取课程失败:', error)
    if (forceRefresh) {
      showToast({ type: 'fail', message: '刷新失败', duration: 3000 })
    } else if (!forceRefresh) {
      showToast({ type: 'fail', message: '加载失败', duration: 3000 })
    }
  } finally {
    if (showLoad && !refreshing.value && !manualRefreshing.value) {
      loading.value = false
      closeToast()
    }
    isRequesting.value = false
    if (forceRefresh) {
      manualRefreshing.value = false
    }
  }
}

// 手动刷新
const manualRefresh = async () => {
  if (manualRefreshing.value) return
  manualRefreshing.value = true
  showLoadingToast({ message: '刷新中...', forbidClick: true })
  isDataLoaded.value = false
  await fetchCourses(true, true)
  closeToast()
}

// 下拉刷新
const onRefresh = async () => {
  isDataLoaded.value = false
  await fetchCourses(false, true)
  refreshing.value = false
}

// 前端搜索过滤
const filterCoursesByKeyword = async () => {
  if (!searchKeyword.value) {
    const stored = localStorage.getItem(STORAGE_KEYS.COURSES)
    if (stored) {
      courseList.value = JSON.parse(stored)
    } else if (!isDataLoaded.value) {
      await fetchCourses(true, false)
    }
    return
  }

  if (!isDataLoaded.value) {
    const stored = localStorage.getItem(STORAGE_KEYS.COURSES)
    if (!stored) {
      await fetchCourses(true, false)
    } else {
      courseList.value = JSON.parse(stored)
      isDataLoaded.value = true
    }
  }

  const keyword = searchKeyword.value.toLowerCase()
  const allCourses = (() => {
    const stored = localStorage.getItem(STORAGE_KEYS.COURSES)
    return stored ? JSON.parse(stored) : courseList.value
  })()

  const filtered = allCourses.filter(course =>
    course.course_name?.toLowerCase().includes(keyword) ||
    course.teacher_name?.toLowerCase().includes(keyword) ||
    course.course_no?.toLowerCase().includes(keyword)
  )

  courseList.value = filtered
}

const onSearch = () => {
  filterCoursesByKeyword()
}

const onClear = () => {
  searchKeyword.value = ''
  const stored = localStorage.getItem(STORAGE_KEYS.COURSES)
  if (stored) {
    courseList.value = JSON.parse(stored)
  } else if (!isDataLoaded.value) {
    fetchCourses(true, false)
  }
}

// 获取人脸上传地址
const getFaceUploadUrl = async (classId, className) => {
  showLoadingToast({ message: '检查人脸识别配置...', forbidClick: true })

  try {
    // 使用 request 替代 fetch
    const result = await request({
      method: 'get',
      url: `/teaching-classes/check-face-recognition/${classId}`
    })

    closeToast()

    if (result.success && result.data && result.data.needFaceRecognition) {
      faceClassId.value = classId
      faceClassName.value = className
      faceUploadUrl.value = result.data.uploadUrl || `/face-recognition/upload/${result.data.userId}/${classId}`
      showFaceDialog.value = true
    } else {
      // 实际不需要人脸识别，直接走正常流程
      pendingCourse.value = pendingFaceCourse.value
      currentWarningMessage.value = getRandomWarningMessage()
      showWarningDialog.value = true
      pendingFaceCourse.value = null
    }
  } catch (error) {
    closeToast()
    console.error('获取人脸识别配置失败:', error)
    showDialog({
      title: '提示',
      message: '获取人脸识别配置失败，是否继续进入考勤？',
      showCancelButton: true,
      confirmButtonText: '继续',
      cancelButtonText: '取消'
    }).then(({ confirm }) => {
      if (confirm) {
        pendingCourse.value = pendingFaceCourse.value
        currentWarningMessage.value = getRandomWarningMessage()
        showWarningDialog.value = true
      }
      pendingFaceCourse.value = null
    })
  }
}
// 人脸识别成功后的回调
const onFaceSuccess = () => {
  if (pendingFaceCourse.value) {
    pendingCourse.value = pendingFaceCourse.value
    currentWarningMessage.value = getRandomWarningMessage()
    showWarningDialog.value = true
    pendingFaceCourse.value = null
  }
}

// 人脸识别取消的回调
const onFaceCancel = () => {
  pendingFaceCourse.value = null
}

// 处理课程点击
const handleCourseClick = (course) => {
  // 检查权限：has_permission 必须为 true
  if (!course.has_permission) {
    showToast({
      type: 'fail',
      message: '没有该教学班的访问权限',
      duration: 3000
    })
    return
  }

  if (!course.course_id) {
    showToast({ type: 'fail', message: '该课程未配置考勤标识（course_id）', duration: 3000 })
    return
  }

  // 检查是否需要人脸识别
  const needFaceRecognition = course.face_recognition_enabled === true || course.face_recognition_enabled === 1

  if (needFaceRecognition) {
    // 需要人脸识别
    pendingFaceCourse.value = course
    getFaceUploadUrl(course.class_id, course.course_name)
  } else {
    // 不需要人脸识别，直接显示警示弹窗
    pendingCourse.value = course
    currentWarningMessage.value = getRandomWarningMessage()
    showWarningDialog.value = true
  }
}

// 弹窗关闭前的回调
const beforeDialogClose = (action) => {
  if (action === 'cancel') {
    pendingCourse.value = null
  }
  return true
}

// 确认进入考勤页面
const confirmNavigateToAttendance = () => {
  if (pendingCourse.value) {
    const course = pendingCourse.value
    router.push({
      path: '/attendance',
      query: {
        courseTeacherId: course.course_id,
        teacherNo: course.teacher_no || ''
      }
    })
    pendingCourse.value = null
  }
}

// 初始化
const init = async (forceRefresh = false) => {
  const hasCache = loadFromStorage()

  if (hasCache && !forceRefresh) {
    console.log('[课程] 使用缓存数据，不发请求')
    isDataLoaded.value = true
    return
  }

  await fetchCourses(true, forceRefresh)
}

onActivated(() => {
  console.log('[课程] 页面激活，使用现有数据，不重新请求')
  if (courseList.value.length > 0 || localStorage.getItem(STORAGE_KEYS.COURSES)) {
    isDataLoaded.value = true
  }
})

onDeactivated(() => {
  console.log('[课程] 页面失活')
})

onMounted(() => {
  init(false)
})
</script>

<style scoped lang="scss">
.courses-page {
  position: relative;
  height: 100vh;
  background: linear-gradient(145deg, #eef2f9 0%, #f8fafc 100%);
}

.fixed-search {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: transparent;
}

.search-bar {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 32px;
  margin: 8px 12px;
  padding: 2px 12px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.7);

  :deep(.van-search) {
    padding: 6px 0;
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

.pull-refresh-wrapper {
  height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-top: 76px;
  box-sizing: border-box;
}

.scroll-content {
  min-height: calc(100vh - 76px);
}

/* 今日课程组件 - 玻璃 + 高光 */
.today-schedule-wrapper {
  margin: 0 12px 12px 12px;
  :deep(.today-schedule) {
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.7);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
    // 添加顶部高光渐变
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50%;
      background: linear-gradient(to bottom, rgba(255,255,255,0.4), transparent);
      border-radius: 28px 28px 0 0;
      pointer-events: none;
    }
    position: relative;
  }
}

/* 课程列表主容器 - 玻璃面板 + 亮边 */
.course-wrapper {
  margin: 0 12px 20px 12px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  overflow: hidden;
  position: relative;
  // 顶部高光线
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(to bottom, rgba(255,255,255,0.35), transparent);
    border-radius: 32px 32px 0 0;
    pointer-events: none;
    z-index: 1;
  }
}

.course-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  background: transparent;
  position: relative;
  z-index: 2;

  .title-section {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .course-title {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
  }

  .course-count {
    font-size: 12px;
    color: #475569;
    font-weight: 500;
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(8px);
    border-radius: 40px;
    font-size: 12px;
    color: #1e293b;
    font-weight: 500;
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 1);
    cursor: pointer;
    transition: all 0.2s;

    &:active {
      transform: scale(0.96);
      background: rgba(255, 255, 255, 0.7);
    }

    .van-icon {
      font-size: 14px;
    }
  }
}

.course-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 14px;
  position: relative;
  z-index: 2;
}

/* 单个课程卡片 - 高光玻璃质感 */
.course-card {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: all 0.25s ease;
  cursor: pointer;
  position: relative;
  // 高光层
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 40%;
    background: linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.1) 100%);
    border-radius: 24px 24px 0 0;
    pointer-events: none;
  }

  &:active {
    transform: scale(0.97);
    background: rgba(255, 255, 255, 0.35);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 1);
  }

  .card-content {
    padding: 14px 12px;
    position: relative;
    z-index: 1;
  }

  .course-name {
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.35;
    margin-bottom: 8px;
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.7);
  }

  .course-teacher {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
    color: #334155;
    margin-bottom: 8px;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);

    .van-icon {
      font-size: 12px;
      color: #475569;
    }
  }

  .course-stats {
    display: flex;
    justify-content: flex-start;
    font-size: 11px;
    font-weight: 500;
    color: #475569;
    border-top: 1px solid rgba(255, 255, 255, 0.5);
    padding-top: 8px;
    margin-top: 4px;

    .students {
      display: flex;
      align-items: center;
      gap: 5px;
    }
  }
}

/* 无教学班提示 - 也添加玻璃高光 */
.no-class-tip {
  text-align: center;
  padding: 60px 20px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(16px);
  border-radius: 36px;
  margin: 20px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 8px 20px rgba(0, 0, 0, 0.05);
  position: relative;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(to bottom, rgba(255,255,255,0.4), transparent);
    border-radius: 36px 36px 0 0;
    pointer-events: none;
  }
  .van-icon {
    margin-bottom: 16px;
    opacity: 0.9;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
  }
  p {
    font-size: 14px;
    color: #334155;
    font-weight: 500;
    margin-bottom: 8px;
  }
  .sub-tip {
    font-size: 12px;
    color: #64748b;
  }
}

.loading-tip {
  text-align: center;
  padding: 40px;
  color: #475569;
  font-size: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(8px);
  border-radius: 30px;
  margin: 20px;
}

.empty {
  margin-top: 40px;
  background: transparent;
  :deep(.van-empty__image) {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.05));
  }
  :deep(.van-empty__description) {
    color: #475569;
  }
}

.bottom-space {
  height: 30px;
}

/* 旷课弹窗样式保持 */
.warning-dialog-content {
  padding: 20px 24px 28px;
  text-align: center;
}
.warning-icon {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}
.warning-message {
  font-size: 16px;
  font-weight: 500;
  color: #e65100;
  line-height: 1.5;
  margin-bottom: 12px;
}
.warning-sub-message {
  font-size: 12px;
  color: #94a3b8;
}
</style>