<template>
    <div class="platform-homework-detail">
        <van-nav-bar title="平台作业详情" left-arrow @click-left="() => router.back()" />

        <div class="detail-content">
            <div class="detail-card">
                <div class="homework-title-row">
                    <h3 class="homework-name">{{ homeworkInfo.name }}</h3>
                    <van-tag v-if="homeworkInfo.pushType === 'GROUP'" type="primary" size="small" round>小组作业</van-tag>
                </div>

                <div class="info-section">
                    <div class="info-item">
                        <van-icon name="bookmark-o" />
                        <span class="label">课程：</span>
                        <span class="value">{{ homeworkInfo.courseName }}</span>
                    </div>

                    <div class="info-item">
                        <van-icon name="manager-o" />
                        <span class="label">教师：</span>
                        <span class="value">{{ homeworkInfo.teacherName }}</span>
                    </div>

                    <div class="info-item">
                        <van-icon name="clock-o" />
                        <span class="label">截止时间：</span>
                        <span class="value" :class="{ expired: isExpired }">{{ homeworkInfo.finishTime }}</span>
                        <van-tag v-if="isExpired" type="danger" size="mini" round>已过期</van-tag>
                    </div>

                    <div class="info-item">
                        <van-icon name="send-gift-o" />
                        <span class="label">发布时间：</span>
                        <span class="value">{{ homeworkInfo.pushTime }}</span>
                    </div>

                    <div class="info-item" v-if="homeworkInfo.answerTime">
                        <van-icon name="clock-o" />
                        <span class="label">作答用时：</span>
                        <span class="answer-time">{{ formatAnswerTime(homeworkInfo.answerTime) }}</span>
                    </div>
                </div>

                <div class="action-buttons">
                    <van-button type="primary" round block @click="doHomework">
                        开始做作业
                    </van-button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, } from 'vant'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()

const homeworkInfo = ref({
    homeworkId: '',
    id: '',
    name: '',
    courseName: '',
    teacherName: '',
    finishTime: '',
    pushTime: '',
    answerTime: '',
    pushType: ''
})

// 判断是否过期
const isExpired = computed(() => {
    if (!homeworkInfo.value.finishTime) return false
    return dayjs().isAfter(dayjs(homeworkInfo.value.finishTime))
})

// 格式化作答时间
const formatAnswerTime = (seconds) => {
    if (!seconds && seconds !== 0) return ''
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
        return `${mins}分${secs}秒`
    }
    return `${secs}秒`
}

// 开始做作业
const doHomework = () => {
    if (isExpired.value) {
        showToast('作业已过期，无法作答')
        return
    }
    // TODO: 跳转到具体的作业答题页面
    showToast('功能开发中，即将开放')
}

onMounted(() => {
    // 从路由参数获取作业信息
    homeworkInfo.value = {
        homeworkId: route.query.homeworkId || '',
        id: route.query.id || '',
        name: route.query.name || '',
        courseName: route.query.courseName || '',
        teacherName: route.query.teacherName || '',
        finishTime: route.query.finishTime || '',
        pushTime: route.query.pushTime || '',
        answerTime: route.query.answerTime || '',
        pushType: route.query.pushType || ''
    }
})
</script>

<style scoped lang="scss">
.platform-homework-detail {
    min-height: 100vh;
    background-color: #f8fafc;

    .detail-content {
        padding: 16px;
    }

    .detail-card {
        background: white;
        border-radius: 20px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    .homework-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid #eef2f6;

        .homework-name {
            font-size: 18px;
            font-weight: 600;
            color: #0f172a;
            margin: 0;
            flex: 1;
        }
    }

    .info-section {
        margin-bottom: 24px;

        .info-item {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
            padding: 10px 0;
            border-bottom: 1px solid #f1f5f9;

            .van-icon {
                font-size: 16px;
                color: #94a3b8;
            }

            .label {
                font-size: 14px;
                color: #64748b;
            }

            .value {
                font-size: 14px;
                color: #1f2d3d;
                flex: 1;

                &.expired {
                    color: #f56c6c;
                }
            }

            .answer-time {
                font-size: 14px;
                color: #67c23a;
                font-weight: 500;
            }
        }
    }

    .action-buttons {
        margin-top: 20px;

        .van-button {
            background: #1e293b;
            border: none;
            height: 44px;

            &:active {
                opacity: 0.9;
            }
        }
    }
}
</style>