import request from '../utils/request'
import { getNonce, getTimestamp, generateEup, generateEb } from '@/utils/zhktCrypto';

// ========== 认证相关 ==========
// 登录
export const login = (data) => {
  return request({
    method: 'post',
    url: '/auth/login',
    data: data
  })
}

// 获取邮箱状态
export const getEmailStatus = () => request.get('/email/status')

// 发送绑定验证码
export const sendBindCode = (email) => request.post('/email/send-bind-code', { email })

// 绑定邮箱
export const bindEmail = (email, code) => request.post('/email/bind', { email, code })

// 发送解绑验证码
export const sendUnbindCode = () => request.post('/email/send-unbind-code')

// 解绑邮箱
export const unbindEmail = (code) => request.post('/email/unbind', { code })

// 切换推送开关
export const toggleSubscription = (enabled) => request.post('/email/toggle-subscription', { enabled })

// 登出
export const logout = () => {
  return request({
    method: 'post',
    url: '/auth/logout'
  })
}

// 检查token
export const checkToken = () => {
  return request({
    method: 'get',
    url: '/auth/check-token'
  })
}

// 获取用户信息
export const getUserInfo = () => {
  return request({
    method: 'get',
    url: '/auth/check-token'
  })
}

// ========== 教学班相关 ==========
// 获取用户所在教学班列表
export const getMyClasses = () => {
  return request({
    method: 'get',
    url: '/teaching-classes/my-classes'
  })
}

// 获取默认教学班ID
export const getDefaultClassId = async () => {
  const res = await getMyClasses()
  if (res.success && res.data && res.data.length > 0) {
    const defaultClass = res.data.find(c => c.is_default === 1)
    if (defaultClass) return defaultClass.id
    return res.data[0].id
  }
  return null
}

// ========== 课程相关 ==========
// 获取用户所在教学班的考勤课程列表（根据用户默认教学班）
export const getMyCourses = () => {
  return request({
    method: 'get',
    url: '/attendance-courses/my-courses'
  })
}

// 获取指定教学班的考勤课程列表
export const getCoursesByClass = (classId) => {
  return request({
    method: 'get',
    url: `/attendance-courses/by-class/${classId}`
  })
}

// ========== 智慧教育平台相关 ==========
// 查询考勤列表
export function getRegisterList(courseTeacherId, teacherNo = '') {
  const timestamp = getTimestamp();
  const nonce = getNonce();
  const queryStr = `courseTeacherId=${courseTeacherId}&teacherNo=${teacherNo}`;
  const _eup = generateEup(queryStr);

  return request({
    method: 'get',
    url: '/zhkt/course/find/register/list',
    params: {
      _t: timestamp,
      _nonce: nonce,
      _eup
    }
  });
}

// 执行考勤
export function doRegister(registerStudentId, registerKey) {
  const timestamp = getTimestamp();
  const nonce = getNonce();
  const postData = {
    id: registerStudentId,
    key: parseInt(registerKey)
  };
  const _eb = generateEb(postData);

  return request({
    method: 'post',
    url: '/zhkt/course/update/student/register',
    params: {
      _t: timestamp,
      _nonce: nonce
    },
    data: { _eb }
  });
}

// ========== 作业相关 ==========
// 获取课程列表（带作业数量）
export const getCoursesWithHomeworkCount = () => {
  return request({
    method: 'get',
    url: '/course/list-with-count'
  })
}

// 获取指定课程的作业列表
export const getHomeworksByCourse = (courseId) => {
  return request({
    method: 'get',
    url: `/homework/course/${courseId}`
  })
}

// 获取作业详情（支持分页，不传分页参数则返回全部）
export const getHomeworkDetail = (homeworkId, params = {}) => {
  return request({
    method: 'get',
    url: `/homework/detail/${homeworkId}`,
    params
  })
}


// 标记作业为已完成
export const markHomeworkComplete = (data) => {
  return request({
    method: 'post',
    url: '/homework/mark-complete',
    data: data
  })
}

// 取消作业完成标记
export const markHomeworkIncomplete = (data) => {
  return request({
    method: 'post',
    url: '/homework/mark-incomplete',
    data: data
  })
}

// ========== 智慧教育平台 - 作业提交相关 ==========
// 获取平台作业列表
export const getPlatformHomeworkList = (studentId, token) => {
  const timestamp = getTimestamp();
  const nonce = getNonce();
  const eupData = {
    pageNum: 1,
    pageSize: 50,
    courseNo: '',
    moduleType: '',
    pushType: '',
    status: 1,
    studentId: studentId
  };
  const eupStr = Object.keys(eupData).map(key => `${key}=${eupData[key]}`).join('&');
  const _eup = generateEup(eupStr);

  return request({
    method: 'get',
    url: '/zhkt/homework/list/v2',
    params: {
      _t: timestamp,
      _nonce: nonce,
      _eup,
      token
    }
  });
}

// 提交作业
export const submitHomework = (submitData, token) => {
  const timestamp = getTimestamp();
  const nonce = getNonce();
  const _eb = generateEb(submitData);

  return request({
    method: 'post',
    url: `/zhkt/homework/saveSubmitHomework?_t=${timestamp}&_nonce=${nonce}&token=${token}`,
    data: { _eb }
  });
}

// 获取平台登录验证码
export const getCaptcha = () => {
  const timestamp = getTimestamp();
  const key = `key=${timestamp}`;
  const _eup = generateEup(key);
  const nonce = getNonce();

  return request({
    method: 'get',
    url: '/zhkt/auth/randomImage',
    params: {
      _t: timestamp,
      _nonce: nonce,
      _eup
    }
  });
}

// 平台登录
export const platformLoginApi = (_eb, timestamp, nonce) => {
  return request({
    method: 'post',
    url: '/zhkt/auth/login',
    params: {
      _t: timestamp,
      _nonce: nonce
    },
    data: { _eb }
  });
}

// 获取学生绑定信息
export const getStudentInfo = () => {
  return request({
    method: 'get',
    url: '/platform/check-student'
  })
}

// 获取平台凭据（加密的密码）
export const getPlatformCredentials = () => {
  return request({
    method: 'get',
    url: '/auth/platform-credentials'
  })
}