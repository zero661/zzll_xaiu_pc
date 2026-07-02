<template>
  <div class="today-schedule">
    <!-- 日期切换栏 -->
    <div class="date-switcher">
      <div class="date-arrow" :class="{ disabled: isPrevDisabled }" @click="prevDate">
        <van-icon name="arrow-left" />
      </div>
      <div class="date-list-container">
        <div class="date-list" ref="dateListRef">
          <div v-for="item in dateList" :key="item.dateStr" class="date-item" :class="{ active: item.isSelected }"
            @click="selectDate(item.date)">
            <div class="weekday">{{ item.weekdayShort }}</div>
            <div class="day">{{ item.day }}</div>
          </div>
        </div>
      </div>
      <div class="date-arrow" :class="{ disabled: isNextDisabled }" @click="nextDate">
        <van-icon name="arrow" />
      </div>
      <div class="today-btn" @click="goToToday">
        <span>今</span>
      </div>
    </div>

    <!-- 课程内容区域 -->
    <div class="schedule-content" v-if="!loading && !loadingClasses">
      <template v-if="selectedDateCourses.length > 0">
        <div class="schedule-header">
          <div class="selected-date-info">
            <span class="date-text">{{ selectedDateText }}</span>
            <span class="week-badge">第{{ currentWeekForSelected }}周</span>
          </div>
        </div>
        <div class="schedule-list">
          <div v-for="(course, index) in selectedDateCourses" :key="index" class="schedule-item"
            @click="handleCourseClick(course)">
            <div class="time-badge">{{ getTimeRange(course) }}</div>
            <div class="course-info">
              <div class="course-name">{{ course.name }}</div>
              <div class="course-meta">
                <span v-if="course.location">
                  <van-icon name="location-o" size="12" />
                  {{ course.location }}
                </span>
              </div>
            </div>
            <van-icon name="arrow" class="arrow-icon" />
          </div>
        </div>
      </template>
      <div v-else-if="hasIcsUrl" class="no-schedule">
        <van-icon name="calendar-o" size="32" color="#94a3b8" />
        <span>当天暂无课程</span>
      </div>
      <div v-else-if="!hasIcsUrl" class="no-schedule">
        <van-icon name="calendar-o" size="32" color="#94a3b8" />
        <span>暂无课表信息</span>
      </div>
    </div>
    <div v-else-if="loadingClasses" class="loading-state">
      <van-loading size="24" /> 加载课表中...
    </div>
    <div v-else class="loading-state">
      <van-loading size="24" /> 加载中...
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { parseICS, getCoursesByDate, getTimeRange, SEMESTER_START } from '@/utils/icalParser';
import { showToast, } from 'vant';
import axios from 'axios';
import { getMyCourses, getMyClasses } from '@/api';

const emit = defineEmits(['course-click']);

const allCourses = ref([]);
const selectedDate = ref(new Date());
const loading = ref(false);
const loadingClasses = ref(false);
const courseList = ref([]);
const icsUrlValue = ref('');
const hasIcsUrl = ref(false);
const defaultClassId = ref(null);
const dateListRef = ref(null);
// 教学班配置映射：class_id -> { has_permission, face_recognition_enabled }
const classConfigMap = ref(new Map());

const today = new Date();
today.setHours(0, 0, 0, 0);

const minDate = new Date(today);
minDate.setDate(today.getDate() - 3);
const maxDate = new Date(today);
maxDate.setDate(today.getDate() + 3);

const weekdayShortMap = ['日', '一', '二', '三', '四', '五', '六'];

const dateList = computed(() => {
  const dates = [];
  for (let i = -3; i <= 3; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const weekday = date.getDay();

    dates.push({
      date: new Date(date),
      dateStr,
      weekdayShort: weekdayShortMap[weekday],
      day: date.getDate(),
      isSelected: date.toDateString() === selectedDate.value.toDateString()
    });
  }
  return dates;
});

const isPrevDisabled = computed(() => {
  const prevDate = new Date(selectedDate.value);
  prevDate.setDate(prevDate.getDate() - 1);
  return prevDate < minDate;
});

const isNextDisabled = computed(() => {
  const nextDate = new Date(selectedDate.value);
  nextDate.setDate(nextDate.getDate() + 1);
  return nextDate > maxDate;
});

const currentWeekForSelected = computed(() => {
  const diffDays = Math.floor((selectedDate.value - SEMESTER_START) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
});

const selectedDateText = computed(() => {
  const d = selectedDate.value;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${month}月${day}日 ${weekdays[d.getDay()]}`;
});

const selectedDateCourses = computed(() => {
  if (!allCourses.value.length) return [];
  return getCoursesByDate(allCourses.value, selectedDate.value);
});

const prevDate = () => {
  if (isPrevDisabled.value) return;
  const newDate = new Date(selectedDate.value);
  newDate.setDate(newDate.getDate() - 1);
  selectedDate.value = newDate;
  scrollToActiveDate();
};

const nextDate = () => {
  if (isNextDisabled.value) return;
  const newDate = new Date(selectedDate.value);
  newDate.setDate(newDate.getDate() + 1);
  selectedDate.value = newDate;
  scrollToActiveDate();
};

const selectDate = (date) => {
  if (date >= minDate && date <= maxDate) {
    selectedDate.value = new Date(date);
    scrollToActiveDate();
  }
};

const goToToday = () => {
  selectedDate.value = new Date(today);
  scrollToActiveDate();
};

const scrollToActiveDate = () => {
  nextTick(() => {
    if (dateListRef.value) {
      const activeItem = dateListRef.value.querySelector('.date-item.active');
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  });
};

// 获取教学班信息并建立配置映射
const fetchClassInfo = async () => {
  loadingClasses.value = true;
  try {
    const res = await getMyClasses();
    console.log('[今日课程] 教学班响应:', res);

    if (res.success && res.data && res.data.length > 0) {
      classConfigMap.value.clear();
      res.data.forEach(cls => {
        classConfigMap.value.set(cls.id, {
          has_permission: cls.has_permission === 1,
          face_recognition_enabled: cls.face_recognition_enabled === 1
        });
      });

      let defaultClass = res.data.find(c => c.is_default === 1);
      if (!defaultClass) {
        defaultClass = res.data[0];
      }
      defaultClassId.value = defaultClass.id;
      const timetableUrl = defaultClass.timetable_url;

      if (timetableUrl) {
        icsUrlValue.value = timetableUrl;
        hasIcsUrl.value = true;
        return true;
      } else {
        hasIcsUrl.value = false;
        return false;
      }
    } else {
      hasIcsUrl.value = false;
      return false;
    }
  } catch (error) {
    console.error('[今日课程] 获取教学班失败:', error);
    hasIcsUrl.value = false;
    return false;
  } finally {
    loadingClasses.value = false;
  }
};

// 获取课程列表（用于匹配 course_id 和配置）
const fetchCourseList = async () => {
  try {
    const res = await getMyCourses();
    if (res.success) {
      const coursesWithConfig = (res.data || []).map(course => {
        const config = classConfigMap.value.get(course.class_id);
        return {
          ...course,
          has_permission: config?.has_permission ?? false,
          face_recognition_enabled: config?.face_recognition_enabled ?? false
        };
      });
      courseList.value = coursesWithConfig;
    }
  } catch (error) {
    console.error('[今日课程] 获取课程列表失败:', error);
  }
};

// 根据课程名称匹配完整的课程信息（包含 course_id, class_id, 配置）
const findCourseIdByName = (courseName) => {
  let match = courseList.value.find(c => c.course_name === courseName);
  if (match) {
    return {
      course_id: match.course_id,
      class_id: match.class_id,
      face_recognition_enabled: match.face_recognition_enabled,
      has_permission: match.has_permission
    };
  }
  // 模糊匹配
  match = courseList.value.find(c =>
    courseName.includes(c.course_name) || c.course_name.includes(courseName)
  );
  if (match) {
    return {
      course_id: match.course_id,
      class_id: match.class_id,
      face_recognition_enabled: match.face_recognition_enabled,
      has_permission: match.has_permission
    };
  }
  console.warn('[今日课程] 未找到匹配的课程:', courseName);
  return null;
};

// 加载 ICS 课表
const loadICS = async () => {
  const hasUrl = await fetchClassInfo();
  if (!hasUrl || !icsUrlValue.value) {
    console.log('[今日课程] 无有效的课表URL');
    return;
  }

  const url = icsUrlValue.value;
  loading.value = true;

  try {
    const response = await axios.get(url, { responseType: 'text' });
    const icsData = response.data;
    allCourses.value = parseICS(icsData);
  } catch (error) {
    console.error('[今日课程] 加载 ICS 文件失败:', error);
    showToast({ type: 'fail', message: '加载课表失败', duration: 3000 });
  } finally {
    loading.value = false;
  }
};

// 处理课程点击：组装完整课程对象并向上传递
const handleCourseClick = async (courseFromICS) => {
  // 确保课程列表已加载
  if (courseList.value.length === 0) {
    await fetchCourseList();
  }

  const courseInfo = findCourseIdByName(courseFromICS.name);
  if (!courseInfo || !courseInfo.course_id) {
    showToast({
      type: 'fail',
      message: `未找到课程"${courseFromICS.name}"的考勤信息`,
      duration: 3000
    });
    return;
  }

  // 合并完整字段
  const fullCourse = {
    ...courseFromICS,
    course_id: courseInfo.course_id,
    class_id: courseInfo.class_id,
    face_recognition_enabled: courseInfo.face_recognition_enabled,
    has_permission: courseInfo.has_permission
  };

  // 向上传递事件，由父组件处理后续逻辑（权限检查、人脸识别、弹窗等）
  emit('course-click', fullCourse);
};

onMounted(async () => {
  selectedDate.value = new Date(today);
  await loadICS();
  await fetchCourseList();
  scrollToActiveDate();
});
</script>

<style scoped lang="scss">
.today-schedule {
  background: white;
  border-radius: 20px;
  margin: 12px;
  padding: 16px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.date-switcher {
  display: flex;
  align-items: center;
  padding: 0 4px;
  margin-bottom: 12px;

  .date-arrow {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border-radius: 50%;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.2s, opacity 0.2s;

    &:active {
      background: #e2e8f0;
    }

    &.disabled {
      opacity: 0.4;
      pointer-events: none;
    }

    .van-icon {
      font-size: 16px;
      color: #1e293b;
    }
  }

  .date-list-container {
    flex: 1;
    overflow-x: auto;
    padding: 0 8px;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .date-list {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .date-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 44px;
    padding: 6px 0;
    border-radius: 20px;
    cursor: pointer;
    transition: background 0.2s;
    overflow: visible;

    &.active {
      background: #1e293b;

      .weekday,
      .day {
        color: white;
      }
    }

    .weekday {
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
      margin-bottom: 2px;
    }

    .day {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }
  }

  .today-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border-radius: 50%;
    cursor: pointer;
    flex-shrink: 0;
    margin-left: 4px;
    transition: background 0.2s;

    &:active {
      background: #e2e8f0;
    }

    span {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
  }
}

.schedule-content {
  padding: 0 16px;
}

.schedule-header {
  margin-bottom: 12px;

  .selected-date-info {
    display: flex;
    align-items: baseline;
    gap: 8px;

    .date-text {
      font-size: 15px;
      font-weight: 600;
      color: #1f2d3d;
    }

    .week-badge {
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      color: #475569;
    }
  }
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  cursor: pointer;
  transition: background-color 0.2s;
  border-radius: 12px;

  &:active {
    background-color: #f8fafc;
  }

  .time-badge {
    min-width: 100px;
    padding: 4px 8px;
    background: #f1f5f9;
    border-radius: 8px;
    font-size: 11px;
    color: #475569;
    text-align: center;
  }

  .course-info {
    flex: 1;

    .course-name {
      font-size: 14px;
      font-weight: 500;
      color: #1f2d3d;
      margin-bottom: 4px;
    }

    .course-meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #94a3b8;

      span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
    }
  }

  .arrow-icon {
    font-size: 14px;
    color: #cbd5e1;
  }
}

.no-schedule,
.loading-state {
  text-align: center;
  padding: 30px 16px;
  color: #94a3b8;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 120px;
}
</style>