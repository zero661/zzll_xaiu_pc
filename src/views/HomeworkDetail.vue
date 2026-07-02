<template>
    <div class="homework-detail-page">
        <!-- 顶部导航始终显示 -->
        <div class="nav-bar">
            <van-icon name="arrow-left" @click="goBack" />
            <span class="title">{{ homework ? homework.name : '作业详情' }}</span>
            <van-icon name="replay" @click="manualRefresh" :class="{ refreshing: manualRefreshing }" />
        </div>
        <div class="nav-placeholder"></div>

        <!-- 内容区域加载状态 -->
        <div v-if="loading" class="content-loading">
            <van-loading size="32" />
            <p>加载中...</p>
        </div>

        <!-- 作业详情内容 -->
        <div v-else-if="homework" class="homework-content">
            <!-- 顶部信息卡片 -->
            <div class="info-card-wrapper">
                <div class="info-card">
                    <div class="info-row">
                        <span class="label">截止时间</span>
                        <span class="value">{{ formatDate(homework.finish_time) }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">绑定学号</span>
                        <span class="value">{{ studentInfo.studentId || '未绑定' }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">平台状态</span>
                        <div class="value">
                            <van-tag :type="isLoggedIn ? 'success' : 'default'" size="small">
                                {{ isLoggedIn ? '已登录' : '未登录' }}
                            </van-tag>
                            <span v-if="isLoggedIn" class="relogin-link" @click="logoutPlatform">重新登录</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 题目列表卡片 -->
            <div class="questions-card">
                <div class="questions-header">
                    <div class="header-left">
                        <span class="title">题目列表</span>
                        <span class="count">共 {{ totalQuestionsCount }} 题</span>
                    </div>
                    <div class="header-right">
                        <van-button class="black-btn outline" size="small" @click="toggleComplete" :loading="marking">
                            {{ homework.is_completed ? '取消完成' : '标记完成' }}
                        </van-button>
                        <van-button class="black-btn" size="small" @click="handleSubmit" :loading="saving">
                            提交保存
                        </van-button>
                    </div>
                </div>

                <div class="time-setting-bar">
                    <span>答题时长</span>
                    <van-stepper v-model="answerTime" min="1" max="3600" step="10" />
                    <span class="unit">秒</span>
                </div>

                <!-- 可滚动区域（题目列表） -->
                <div class="questions-scroll-area" ref="questionsScrollRef">
                    <div class="questions-list">
                        <div v-for="(question, idx) in questions" :key="question.id" class="question-item">
                            <div class="question-header">
                                <span class="question-num">{{ (currentPage - 1) * pageSize + idx + 1 }}.</span>
                                <span class="question-type">{{ getQuestionTypeName(question.title) }}</span>
                                <span class="question-score">({{ question.score }}分)</span>
                            </div>
                            <div class="question-content" v-html="question.content"></div>

                            <div class="answer-display">
                                <div class="answer-label">
                                    <van-icon name="passed" />
                                    <span>正确答案</span>
                                </div>

                                <!-- 单选题 -->
                                <div v-if="question.title === '单选题'" class="single-choice">
                                    <van-radio-group v-model="answers[question.id]" disabled
                                        direction="vertical">
                                        <van-radio v-for="(opt, optIdx) in question.options" :key="optIdx"
                                            :name="String.fromCharCode(65 + optIdx)">
                                            <span v-html="opt"></span>
                                        </van-radio>
                                    </van-radio-group>
                                    <div class="correct-answer">
                                        <van-tag type="success" size="small">
                                            正确答案：{{ getSingleAnswerDisplay(question) }}
                                        </van-tag>
                                    </div>
                                </div>

                                <!-- 判断题 -->
                                <div v-else-if="question.title === '判断题'" class="judge-choice">
                                    <van-radio-group v-model="answers[question.id]" disabled
                                        direction="vertical">
                                        <van-radio name="对">对</van-radio>
                                        <van-radio name="错">错</van-radio>
                                    </van-radio-group>
                                    <div class="correct-answer">
                                        <van-tag type="success" size="small">
                                            正确答案：{{ answers[question.id] === '对' ? '对' : '错' }}
                                        </van-tag>
                                    </div>
                                </div>

                                <!-- 多选题 -->
                                <div v-else-if="question.title === '多选题'" class="multiple-choice">
                                    <van-checkbox-group v-model="answers[question.id]" disabled
                                        direction="vertical">
                                        <van-checkbox v-for="(opt, optIdx) in question.options" :key="optIdx"
                                            :name="String.fromCharCode(65 + optIdx)">
                                            <span v-html="opt"></span>
                                        </van-checkbox>
                                    </van-checkbox-group>
                                    <div class="correct-answer">
                                        <van-tag type="success" size="small">
                                            正确答案：{{ getMultipleAnswerDisplay(question) }}
                                        </van-tag>
                                    </div>
                                </div>

                                <!-- 填空题 -->
                                <div v-else-if="question.title === '填空题'" class="fill-blanks">
                                    <div class="fill-answers">
                                        <div v-for="(blank, blankIdx) in getBlankList(question)" :key="blankIdx"
                                            class="fill-item">
                                            <span class="fill-index">空{{ blankIdx + 1 }}：</span>
                                            <span class="fill-value">{{ blank.selectedAnswer }}</span>
                                            <van-icon v-if="blank.options.length > 1" name="question-o"
                                                class="info-icon" />
                                        </div>
                                    </div>
                                    <div v-if="hasMultipleOptions(question)" class="all-options">
                                        <van-icon name="records-o" />
                                        <span>可选答案：{{ getAllOptionsText(question) }}</span>
                                    </div>
                                </div>

                                <!-- 其他 -->
                                <div v-else class="other-choice">
                                    <span class="answer-value">{{ getDefaultAnswerDisplay(question) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 分页组件 -->
                <div v-if="pagination && pagination.total_pages > 1" class="pagination-fixed">
                    <div class="pagination-buttons">
                        <van-button size="small" :disabled="currentPage === 1"
                            @click="handlePageChange(currentPage - 1)" class="page-btn">
                            上一页
                        </van-button>
                        <span class="page-info">{{ currentPage }} / {{ pagination.total_pages }}</span>
                        <van-button size="small" :disabled="currentPage === pagination.total_pages"
                            @click="handlePageChange(currentPage + 1)" class="page-btn">
                            下一页
                        </van-button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 登录弹窗 - 使用统一的组件 -->
        <ZhktLoginDialog
            v-model:visible="showLoginDialog"
            :username="platformCredentials.studentId"
            :encrypted-password="platformCredentials.encryptedPassword"
            @login-success="onLoginSuccess"
            @login-fail="onLoginFail"
        />

        <!-- 提交确认弹窗 -->
        <van-dialog v-model:show="showSubmitConfirmDialog" title="确认提交" show-cancel-button @confirm="doSubmitHomework">
            <div class="submit-confirm-content">
                <van-notice-bar text="请确认以下作业数据" left-icon="warning-o" color="#e6a23c" />
                <div class="submit-info">
                    <div class="json-preview">
                        <div class="json-title">作业JSON数据：</div>
                        <pre class="json-content">{{ JSON.stringify(submitDataPreview, null, 2) }}</pre>
                    </div>
                    <div class="submit-params">
                        <div>答题时长：{{ submitParams.answerTime }}秒</div>
                    </div>
                </div>
            </div>
        </van-dialog>
    </div>
</template>
<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showLoadingToast, closeToast, showSuccessToast, showFailToast } from 'vant'
import dayjs from 'dayjs'
import {
    getHomeworkDetail,
    getStudentInfo,
    getPlatformCredentials,
    markHomeworkComplete,
    markHomeworkIncomplete
} from '@/api'
import { zhktApi } from '@/utils/zhktApi'
import ZhktLoginDialog from '@/components/ZhktLoginDialog.vue'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const homework = ref(null)
const questions = ref([])
const allQuestionsRaw = ref([]) // 存储所有原始题目数据
const pagination = ref(null)
const currentPage = ref(1)
const pageSize = ref(10)

// 答案存储结构：使用 question.id 作为 key
const answers = ref({})
const answerTime = ref(49)
const saving = ref(false)
const marking = ref(false)
const manualRefreshing = ref(false)
const questionsScrollRef = ref(null)

const studentInfo = ref({ studentId: '', realName: '' })
const showLoginDialog = ref(false)
const showSubmitConfirmDialog = ref(false)

const isLoggedIn = ref(false)

const submitDataPreview = ref({})
const submitParams = ref({})
const platformCredentials = ref({ studentId: '', encryptedPassword: '' })
const pendingSubmit = ref(false)

// 计算总题目数量
const totalQuestionsCount = computed(() => {
    return pagination.value?.total || allQuestionsRaw.value.length || questions.value.length
})

// ---------- 辅助函数 ----------
const formatDate = (date) => {
    if (!date) return ''
    return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const getQuestionTypeName = (title) => {
    const map = { '单选题': '单选题', '判断题': '判断题', '填空题': '填空题', '多选题': '多选题' }
    return map[title] || title
}

const parseFillBlankAnswers = (answerString) => {
    if (!answerString) return []
    if (typeof answerString === 'string') {
        const blanks = answerString.split('【*下一空答案*】')
        return blanks.map(blank => {
            let cleanBlank = blank.replace(/<[^>]*>/g, '').trim()
            if (!cleanBlank) return []
            const options = cleanBlank.split(';').map(opt => opt.trim()).filter(opt => opt)
            return options.length > 0 ? options : [cleanBlank]
        })
    }
    if (Array.isArray(answerString)) {
        return answerString.map(blank => {
            if (typeof blank === 'string' && blank.includes(';')) {
                return blank.split(';').map(opt => opt.trim()).filter(opt => opt)
            }
            return [blank]
        })
    }
    return []
}

const getRandomAnswer = (options) => {
    if (!options || options.length === 0) return ''
    if (options.length === 1) return options[0]
    const randomIndex = Math.floor(Math.random() * options.length)
    return options[randomIndex]
}

const getBlankList = (question) => {
    if (!question._blankList) {
        const parsedAnswers = parseFillBlankAnswers(question.answer)
        question._blankList = parsedAnswers.map((options, idx) => {
            const key = `${question.id}_blank_${idx}`
            const selectedAnswer = answers.value[key] || getRandomAnswer(options)
            if (!answers.value[key]) answers.value[key] = selectedAnswer
            return { options, selectedAnswer, key }
        })
    }
    return question._blankList
}

const hasMultipleOptions = (question) => {
    const blanks = getBlankList(question)
    return blanks.some(blank => blank.options.length > 1)
}

const getAllOptionsText = (question) => {
    const blanks = getBlankList(question)
    return blanks.map(blank => blank.options.join('、')).join('；')
}

const getSingleAnswerDisplay = (question) => {
    const answerValue = answers.value[question.id]
    if (!answerValue) return '未选择'
    return `${answerValue}`
}

const getMultipleAnswerDisplay = (question) => {
    if (!question.answer || question.answer.length === 0) return '无'
    let answersList = question.answer
    if (typeof answersList === 'string') {
        let cleanAnswer = answersList.replace(/<[^>]*>/g, '').trim()
        if (cleanAnswer.includes('【*下一空答案*】')) {
            answersList = cleanAnswer.split('【*下一空答案*】').map(a => a.trim()).filter(a => a)
        } else {
            answersList = cleanAnswer.split(/\s+/).filter(a => a.trim())
        }
    }
    const displayAnswers = answersList.map(ans => {
        return `${ans}`
    })
    return displayAnswers.join('；')
}

const getDefaultAnswerDisplay = (question) => {
    if (!question.answer) return '未设置'
    let answerValue = ''
    if (Array.isArray(question.answer)) answerValue = question.answer[0]
    else if (typeof question.answer === 'string') answerValue = question.answer
    else answerValue = String(question.answer)
    if (answerValue === '对' || answerValue === '错') return answerValue
    return answerValue
}

// 自动填充答案（基于题目列表）
const autoFillAnswersForQuestions = (questionsList) => {
    if (!questionsList || !questionsList.length) return
    for (const q of questionsList) {
        if (q.title === '单选题' || q.title === '判断题') {
            if (q.answer && q.answer.length > 0 && !answers.value[q.id]) {
                answers.value[q.id] = q.answer[0]
            }
        } else if (q.title === '多选题') {
            if (q.answer && q.answer.length > 0 && !answers.value[q.id]) {
                if (typeof q.answer === 'string') {
                    const answerArray = q.answer.trim().split(/\s+/).filter(a => a)
                    answers.value[q.id] = answerArray
                } else {
                    answers.value[q.id] = [...q.answer]
                }
            }
        } else if (q.title === '填空题') {
            const parsedAnswers = parseFillBlankAnswers(q.answer)
            for (let i = 0; i < parsedAnswers.length; i++) {
                const key = `${q.id}_blank_${i}`
                if (!answers.value[key]) {
                    answers.value[key] = getRandomAnswer(parsedAnswers[i])
                }
            }
        } else {
            if (q.answer && q.answer.length > 0 && !answers.value[q.id]) {
                answers.value[q.id] = q.answer[0]
            }
        }
    }
}

// 加载所有题目数据（合并到统一的题目列表中）
const loadAllQuestions = async () => {
    const homeworkId = route.query.homeworkId
    if (!homeworkId) return
    
    try {
        const totalPages = pagination.value?.total_pages || 1
        if (totalPages <= 1) {
            allQuestionsRaw.value = [...questions.value]
        } else {
            const allQuestionsTemp = []
            for (let page = 1; page <= totalPages; page++) {
                const res = await getHomeworkDetail(homeworkId, { page, pageSize: pageSize.value })
                if (res.success && res.data.questions) {
                    allQuestionsTemp.push(...res.data.questions)
                }
            }
            allQuestionsRaw.value = allQuestionsTemp
        }
        
        autoFillAnswersForQuestions(allQuestionsRaw.value)
        console.log(`加载了 ${allQuestionsRaw.value.length} 道题目`)
    } catch (e) {
        console.error('加载所有题目失败:', e)
        allQuestionsRaw.value = [...questions.value]
    }
}

// ---------- 平台登录相关（使用 zhktApi）----------
const checkLocalLogin = () => {
    if (zhktApi.checkLocalLogin()) {
        isLoggedIn.value = true
        return true
    }
    return false
}

const onLoginSuccess = async () => {
    isLoggedIn.value = true
    showSuccessToast('登录成功')
    if (pendingSubmit.value) {
        pendingSubmit.value = false
        goToSubmitConfirm()
    }
}

const onLoginFail = (data) => {
    showFailToast(data.message || '登录失败')
}

const openLoginDialog = async () => {
    try {
        const res = await getPlatformCredentials()
        if (res.success && res.data.hasCredentials) {
            platformCredentials.value = {
                studentId: res.data.studentId,
                encryptedPassword: res.data.encryptedPassword
            }
        }
    } catch (e) {
        console.log('获取平台凭据失败:', e)
    }
    showLoginDialog.value = true
}

const logoutPlatform = () => {
    zhktApi.logout()
    isLoggedIn.value = false
    showSuccessToast('已退出平台登录')
}

// ---------- 作业相关 ----------
const loadHomeworkDetail = async () => {
    const homeworkId = route.query.homeworkId
    if (!homeworkId) {
        showToast('缺少作业ID')
        goBack()
        return
    }
    loading.value = true
    try {
        const res = await getHomeworkDetail(homeworkId, { page: currentPage.value, pageSize: pageSize.value })
        if (res.success) {
            homework.value = res.data
            questions.value = res.data.questions || []
            pagination.value = res.data.pagination
            
            autoFillAnswersForQuestions(questions.value)
            await loadAllQuestions()
            
            nextTick(() => {
                if (questionsScrollRef.value) questionsScrollRef.value.scrollTo({ top: 0, behavior: 'smooth' })
            })
        } else {
            showToast(res.message || '获取失败')
            goBack()
        }
    } catch (e) {
        console.error(e)
        showToast('加载失败')
    } finally {
        loading.value = false
    }
}

const handlePageChange = async (page) => {
    currentPage.value = page
    const homeworkId = route.query.homeworkId
    try {
        const res = await getHomeworkDetail(homeworkId, { page, pageSize: pageSize.value })
        if (res.success) {
            questions.value = res.data.questions || []
            pagination.value = res.data.pagination
            autoFillAnswersForQuestions(questions.value)
            nextTick(() => {
                if (questionsScrollRef.value) questionsScrollRef.value.scrollTo({ top: 0, behavior: 'smooth' })
            })
        }
    } catch (e) {
        showToast('加载失败')
    }
}

const manualRefresh = async () => {
    if (manualRefreshing.value) return
    manualRefreshing.value = true
    showLoadingToast('刷新中...')
    await loadHomeworkDetail()
    manualRefreshing.value = false
    closeToast()
}

const toggleComplete = async () => {
    const homeworkId = route.query.homeworkId
    if (!homeworkId) {
        showToast('作业ID不存在')
        return
    }
    marking.value = true
    showLoadingToast({ message: '处理中...', forbidClick: true })
    try {
        let res
        if (homework.value.is_completed) {
            res = await markHomeworkIncomplete({ homeworkId })
        } else {
            res = await markHomeworkComplete({ homeworkId })
        }
        if (res.success) {
            showToast(homework.value.is_completed ? '已取消完成' : '已标记为完成')
            await loadHomeworkDetail()
        } else {
            showToast(res.message || '操作失败')
        }
    } catch (error) {
        console.error('操作失败:', error)
        showToast('操作失败，请重试')
    } finally {
        marking.value = false
        closeToast()
    }
}

// 获取平台作业ID（使用 zhktApi）
const fetchPlatformHomeworkId = async () => {
    if (!isLoggedIn.value || !studentInfo.value.studentId) return null
    
    try {
        const result = await zhktApi.get('/homework/list/v2', {
            pageNum: 1,
            pageSize: 50,
            status: 1,
            studentId: studentInfo.value.studentId
        })
        
        if (result.success && result.data?.list) {
            const list = result.data.list
            const hw = homework.value
            let target = null
            if (hw.platform_homework_id) target = list.find(i => i.homeworkId === hw.platform_homework_id)
            if (!target && hw.platform_id) target = list.find(i => i.id === hw.platform_id)
            if (!target && hw.name) target = list.find(i => i.name === hw.name)
            return target?.id || null
        } else if (result.needLogin) {
            logoutPlatform()
            return null
        }
    } catch (e) {
        console.log('获取平台作业ID失败:', e)
    }
    return null
}

// 构建提交数据
const buildSubmitDataWithAllQuestions = (submitId) => {
    const dataList = []
    const questionsToSubmit = allQuestionsRaw.value.length > 0 ? allQuestionsRaw.value : questions.value
    
    console.log(`准备提交 ${questionsToSubmit.length} 道题目`)
    
    for (const q of questionsToSubmit) {
        let sa = ''
        
        if (q.title === '填空题') {
            const arr = []
            const parsedAnswers = parseFillBlankAnswers(q.answer)
            for (let i = 0; i < parsedAnswers.length; i++) {
                const answerKey = `${q.id}_blank_${i}`
                const answerValue = answers.value[answerKey]
                arr.push(answerValue || '')
            }
            sa = arr.join('【*下一空答案*】')
        } else if (q.title === '多选题') {
            const answerValue = answers.value[q.id]
            if (Array.isArray(answerValue)) {
                sa = answerValue.join('【*下一空答案*】')
            } else if (typeof answerValue === 'string') {
                sa = answerValue
            } else {
                sa = ''
            }
        } else {
            sa = answers.value[q.id] || ''
        }
        
        dataList.push({ 
            id: q.id, 
            questionId: q.questionId, 
            studentAnswer: sa, 
            fileList: [], 
            imageStringList: [null] 
        })
    }
    
    return {
        homeworkId: homework.value?.platform_homework_id,
        id: submitId,
        studentId: studentInfo.value.studentId,
        answerTime: answerTime.value,
        dataList
    }
}

// 使用 zhktApi 的 post 方法提交作业
const doSubmitHomework = async () => {
    saving.value = true
    showLoadingToast('提交中...')
    try {
        // 构建提交数据
        const submitData = {
            ...submitDataPreview.value,
            // 不需要额外加密，zhktApi.post 会自动加密
        }
        
        // 使用 zhktApi 的 post 方法，它会自动处理加密
        const result = await zhktApi.post('/homework/saveSubmitHomework', submitData)
        
        closeToast()
        if (result.success) {
            showSuccessToast('提交成功')
            showSubmitConfirmDialog.value = false
            await loadHomeworkDetail()
        } else if (result.needLogin) {
            showFailToast('登录已过期，请重新登录')
            logoutPlatform()
            openLoginDialog()
            pendingSubmit.value = true
        } else {
            showFailToast(result.message || '提交失败')
        }
    } catch (e) {
        closeToast()
        console.error('提交失败:', e)
        showFailToast('提交失败')
    } finally {
        saving.value = false
    }
}

const goToSubmitConfirm = async () => {
    if (!studentInfo.value.studentId) await loadStudentInfo()
    if (!isLoggedIn.value) {
        showToast('请先登录')
        openLoginDialog()
        pendingSubmit.value = true
        return
    }
    
    if (allQuestionsRaw.value.length === 0 && questions.value.length > 0) {
        showLoadingToast('加载作业数据...')
        await loadAllQuestions()
        closeToast()
    }
    
    if (allQuestionsRaw.value.length === 0 && questions.value.length === 0) {
        showToast('没有题目数据')
        return
    }
    
    const questionsToCheck = allQuestionsRaw.value.length > 0 ? allQuestionsRaw.value : questions.value
    let missingCount = 0
    for (const q of questionsToCheck) {
        if (q.title === '填空题') {
            const parsedAnswers = parseFillBlankAnswers(q.answer)
            for (let i = 0; i < parsedAnswers.length; i++) {
                const answerKey = `${q.id}_blank_${i}`
                if (!answers.value[answerKey]) {
                    missingCount++
                }
            }
        } else {
            if (!answers.value[q.id]) {
                missingCount++
            }
        }
    }
    
    if (missingCount > 0) {
        console.warn(`共有 ${missingCount} 个答案未填写，将使用默认值`)
    }
    
    showLoadingToast('获取作业信息...')
    try {
        const submitId = await fetchPlatformHomeworkId()
        if (!submitId) {
            closeToast()
            showToast('无法获取作业ID，请检查登录状态或作业配置')
            return
        }
        
        const rawSubmitData = buildSubmitDataWithAllQuestions(submitId)
        
        submitDataPreview.value = rawSubmitData
        
        closeToast()
        showSubmitConfirmDialog.value = true
    } catch (e) {
        closeToast()
        console.error('获取提交信息失败:', e)
        showToast('获取失败')
    }
}

const handleSubmit = () => {
    const hasQuestions = allQuestionsRaw.value.length > 0 || questions.value.length > 0
    if (!hasQuestions) {
        showToast('作业数据加载中，请稍后重试')
        return
    }
    
    if (isLoggedIn.value) {
        goToSubmitConfirm()
    } else {
        openLoginDialog()
        pendingSubmit.value = true
    }
}

const loadStudentInfo = async () => {
    try {
        const res = await getStudentInfo()
        if (res.success && res.data.hasStudentInfo) {
            studentInfo.value = { studentId: res.data.studentId, realName: res.data.realName }
        }
    } catch (e) {
        console.log('获取学生信息失败:', e)
    }
}

const goBack = () => router.back()

onMounted(() => {
    checkLocalLogin()
    loadHomeworkDetail()
    loadStudentInfo()
})
</script>

<style scoped lang="scss">
.homework-detail-page {
    height: 100vh;
    background-color: #f8fafc;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.homework-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
}

.content-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #94a3b8;
    background-color: #f8fafc;
    min-height: 200px;
}

.nav-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background-color: white;
    border-bottom: 1px solid #eef2f6;
    z-index: 100;
    flex-shrink: 0;

    .van-icon {
        font-size: 22px;
        cursor: pointer;
    }

    .refreshing {
        animation: rotate 0.5s linear infinite;
    }

    .title {
        font-size: 18px;
        font-weight: 600;
        color: #1f2d3d;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        text-align: center;
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

.nav-placeholder {
    height: 54px;
    flex-shrink: 0;
}

.info-card-wrapper {
    padding: 0 12px 12px 12px;
    flex-shrink: 0;
}

.info-card {
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    overflow: hidden;

    .info-row {
        display: flex;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 14px;

        &:last-child {
            border-bottom: none;
        }

        .label {
            color: #64748b;
        }

        .value {
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 8px;

            .relogin-link {
                font-size: 12px;
                color: #1a73e8;
                cursor: pointer;
            }
        }
    }
}

.questions-card {
    flex: 1;
    margin: 0 12px 12px 12px;
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
}

.questions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #eef2f6;
    background: white;
    border-radius: 20px 20px 0 0;
    flex-shrink: 0;

    .header-left {
        display: flex;
        align-items: baseline;
        gap: 8px;

        .title {
            font-size: 15px;
            font-weight: 600;
            color: #1e293b;
        }

        .count {
            font-size: 12px;
            color: #94a3b8;
        }
    }

    .header-right {
        display: flex;
        gap: 8px;
    }
}

.black-btn {
    background: #1e293b;
    border: none;
    color: white;
    border-radius: 20px;
    padding: 0 12px;
    height: 32px;
    font-size: 13px;
    font-weight: 500;

    &.outline {
        background: transparent;
        border: 1px solid #1e293b;
        color: #1e293b;
    }
}

.time-setting-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    font-size: 14px;
    color: #475569;
    border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;

    .unit {
        color: #94a3b8;
    }
}

.questions-scroll-area {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    min-height: 0;
    transform: translateZ(0);
}

.questions-list {
    padding: 12px;
}

.question-item {
    background: #ffffff;
    border-radius: 16px;
    padding: 14px 12px;
    margin-bottom: 12px;
    border: 1px solid #eef2f6;
    transition: all 0.2s;

    &:active {
        transform: scale(0.98);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    .question-header {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 10px;
        flex-wrap: wrap;

        .question-num {
            font-weight: 600;
            color: #1a73e8;
        }

        .question-type {
            font-size: 12px;
            background: #f1f5f9;
            color: #475569;
            padding: 2px 8px;
            border-radius: 20px;
        }

        .question-score {
            font-size: 12px;
            color: #f59e0b;
            font-weight: 500;
        }
    }

    .question-content {
        background: #f8fafc;
        border-radius: 12px;
        padding: 12px;
        font-size: 14px;
        line-height: 1.5;
        color: #1e293b;
        margin-bottom: 12px;
        border: 1px solid #eef2f6;
    }

    .answer-display {
        .answer-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: #10b981;
            margin-bottom: 8px;
        }
    }
}

.correct-answer {
    margin-top: 10px;
}

.fill-blanks {
    .fill-answers {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px;
        background: #f0fdf4;
        border-radius: 12px;

        .fill-item {
            background: #fff;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            border: 1px solid #dcfce7;

            .fill-index {
                color: #1a73e8;
                font-weight: 500;
            }

            .fill-value {
                font-weight: 500;
                color: #0f172a;
            }
        }
    }

    .all-options {
        margin-top: 8px;
        font-size: 12px;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 6px;
    }
}

.other-choice {
    .answer-value {
        display: inline-block;
        background: #f1f5f9;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 13px;
        color: #0f172a;
    }
}

.pagination-fixed {
    flex-shrink: 0;
    padding: 12px 16px;
    background: white;
    border-top: 1px solid #f1f5f9;
    border-radius: 0 0 20px 20px;
}

.pagination-buttons {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;

    .page-btn {
        min-width: 80px;
        border-radius: 20px;
        background-color: #f1f5f9;
        border: none;
        color: #1e293b;
        font-size: 14px;
        font-weight: 500;
        padding: 0 12px;

        &:active {
            opacity: 0.7;
        }

        &[disabled] {
            opacity: 0.4;
            background-color: #f1f5f9;
        }
    }

    .page-info {
        font-size: 14px;
        color: #64748b;
        font-weight: 500;
        min-width: 60px;
        text-align: center;
    }
}

.bottom-space {
    height: 12px;
}

.submit-confirm-content {
    .json-preview {
        background: #f8fafc;
        border-radius: 8px;
        padding: 12px;
        margin-top: 12px;

        .json-content {
            background: #1e293b;
            color: #fff;
            padding: 10px;
            border-radius: 6px;
            font-size: 11px;
            max-height: 260px;
            overflow: auto;
        }
    }
}
</style>