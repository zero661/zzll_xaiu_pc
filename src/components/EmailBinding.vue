<!-- src/views/mb/EmailBinding.vue -->
<template>
    <div class="email-binding-page">
        <div class="page-container">
            <!-- 当前邮箱状态 -->
            <div class="status-card card" v-if="emailStatus">
                <div class="status-item">
                    <div class="label">绑定邮箱</div>
                    <div class="value">
                        <span class="email-text">{{ emailStatus.email || '未绑定' }}</span>
                        <van-tag v-if="emailStatus.emailVerified" type="success" size="medium">已验证</van-tag>
                        <van-tag v-else-if="emailStatus.email" type="warning" size="medium">未验证</van-tag>
                    </div>
                </div>

                <div class="status-item">
                    <div class="label">定时推送</div>
                    <div class="value">
                        <van-switch v-model="subscriptionEnabled" @change="toggleSubscription"
                            :disabled="!emailStatus.emailVerified" size="22px" />
                        <span class="tip" v-if="!emailStatus.emailVerified && emailStatus.email">（请先验证邮箱）</span>
                        <span class="tip" v-else-if="!emailStatus.email">（请先绑定邮箱）</span>
                    </div>
                </div>
            </div>

            <!-- 绑定表单 -->
            <div class="bind-form card" v-if="!emailStatus?.email">
                <div class="form-title">绑定新邮箱</div>

                <van-field v-model="bindForm.email" label="邮箱" placeholder="请输入邮箱地址" type="email"
                    :disabled="sendingCode" />

                <van-field v-model="bindForm.code" label="验证码" placeholder="请输入验证码" :disabled="binding">
                    <template #button>
                        <van-button size="small" :disabled="!canSendCode || sendingCode" @click="sendBindCode"
                            :loading="sendingCode" type="primary" plain>
                            {{ sendCodeText }}
                        </van-button>
                    </template>
                </van-field>

                <div class="form-actions">
                    <van-button type="primary" block @click="bindEmail" :loading="binding" round>
                        绑定邮箱
                    </van-button>
                    <van-button plain block @click="resetForm" round>重置</van-button>
                </div>
            </div>

            <!-- 已绑定的操作 -->
            <div class="action-card card" v-else>
                <div class="info-tip">
                    <van-icon name="info-o" />
                    <span>邮箱已绑定，您将收到每日学习推送</span>
                </div>
                <van-button type="danger" plain block @click="showUnbindDialog" round>
                    解绑邮箱
                </van-button>
            </div>

            <!-- 解绑对话框 -->
            <van-dialog v-model:show="unbindDialogVisible" title="解绑邮箱" show-cancel-button @confirm="unbindEmail"
                :before-close="onUnbindDialogClose">
                <div class="unbind-content">
                    <van-field v-model="unbindForm.code" label="验证码" placeholder="请输入验证码">
                        <template #button>
                            <van-button size="small" @click="sendUnbindCode" :loading="sendingUnbindCode" type="danger"
                                plain>
                                发送验证码
                            </van-button>
                        </template>
                    </van-field>
                </div>
            </van-dialog>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { showToast, showLoadingToast, closeToast, showDialog } from 'vant'
import axios from 'axios'

const emailStatus = ref(null)
const subscriptionEnabled = ref(false)

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
const unbindDialogVisible = ref(false)
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

// 获取邮箱状态
const fetchEmailStatus = async () => {
    try {
        const token = localStorage.getItem('token')
        const res = await axios.get('/api/email/status', {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (res.data.success) {
            emailStatus.value = res.data.data
            subscriptionEnabled.value = res.data.data.subscriptionEnabled
        }
    } catch (error) {
        console.error('获取邮箱状态失败:', error)
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

// 绑定邮箱
const bindEmail = async () => {
    if (!bindForm.email || !bindForm.code) {
        showToast('请填写邮箱和验证码')
        return
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
            await fetchEmailStatus()
            resetForm()
        } else {
            showToast(res.data.message)
        }
    } catch (error) {
        closeToast()
        showToast(error.response?.data?.message || '绑定失败')
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

// 解绑邮箱
const unbindEmail = async () => {
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
            unbindDialogVisible.value = false
            await fetchEmailStatus()
            unbindForm.code = ''
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
        }
    } catch (error) {
        showToast(error.response?.data?.message || '操作失败')
        subscriptionEnabled.value = !enabled
    }
}

// 显示解绑对话框
const showUnbindDialog = () => {
    unbindForm.code = ''
    unbindDialogVisible.value = true
}

// 对话框关闭回调
const onUnbindDialogClose = (action) => {
    if (action === 'confirm') {
        return unbindEmail()
    }
    unbindForm.code = ''
    return true
}

// 重置表单
const resetForm = () => {
    bindForm.email = ''
    bindForm.code = ''
}

// 检查是否需要提醒绑定邮箱
const checkAndPromptBind = () => {
    if (!emailStatus.value?.email) {
        setTimeout(() => {
            showDialog({
                title: '温馨提示',
                message: '绑定邮箱后可接收每日学习推送，及时获取课程和作业提醒。',
                confirmButtonText: '去绑定',
                cancelButtonText: '稍后'
            }).then(({ confirm }) => {
                if (confirm) {
                    // 已经在邮箱绑定页面，不需要跳转
                }
            })
        }, 500)
    }
}

onMounted(() => {
    fetchEmailStatus().then(() => {
        checkAndPromptBind()
    })
})
</script>

<style scoped lang="scss">
.email-binding-page {
    min-height: 100vh;
    background-color: #f5f7fa;
}

.page-container {
    padding: 16px;
}

.card {
    background: white;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.status-card {
    .status-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #f0f2f5;

        &:last-child {
            border-bottom: none;
        }

        .label {
            font-size: 15px;
            color: #475569;
        }

        .value {
            display: flex;
            align-items: center;
            gap: 8px;

            .email-text {
                font-size: 14px;
                color: #1f2d3d;
            }

            .tip {
                font-size: 12px;
                color: #94a3b8;
            }
        }
    }
}

.bind-form {
    .form-title {
        font-size: 16px;
        font-weight: 500;
        color: #1f2d3d;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid #f0f2f5;
    }

    .form-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;

        :deep(.van-button) {
            flex: 1;
        }
    }
}

.action-card {
    .info-tip {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background-color: #eef2ff;
        border-radius: 12px;
        margin-bottom: 20px;
        color: #1e40af;
        font-size: 14px;

        .van-icon {
            font-size: 18px;
        }
    }
}

.unbind-content {
    padding: 16px;
}
</style>