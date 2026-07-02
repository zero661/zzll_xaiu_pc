import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { showTabbar: false }
  },
  {
    path: '/courses',
    name: 'Courses',
    component: () => import('@/views/Courses.vue'),
    meta: { showTabbar: true, requiresAuth: true }
  },
  {
    path: '/homework',
    name: 'Homework',
    component: () => import('@/views/Homework.vue'),
    meta: { showTabbar: true, requiresAuth: true }
  },
  {
    path: '/platform-homework-detail',
    name: 'PlatformHomeworkDetail',
    component: () => import('@/views/PlatformHomeworkDetail.vue'),
    meta: { showTabbar: true, requiresAuth: true }
  },
  {
    path: '/homework-detail',
    name: 'HomeworkDetail',
    component: () => import('@/views/HomeworkDetail.vue'),
    meta: { showTabbar: false, requiresAuth: true }
  },
   {
    path: '/email-binding',
    name: 'EmailBinding',
    component: () => import('@/components/EmailBinding.vue'),
    meta: { showTabbar: false, title: '邮箱绑定' }
  },
  {
    path: '/attendance',
    name: 'Attendance',
    component: () => import('@/views/CourseAttendance.vue'),
    meta: { showTabbar: false, requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    meta: { showTabbar: true, requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const token = localStorage.getItem('token')
  const isLoggedIn = !!token

  if (requiresAuth && !isLoggedIn) {
    next('/login')
  } else if (to.path === '/login' && isLoggedIn) {
    next('/courses')
  } else {
    next()
  }
})

export default router