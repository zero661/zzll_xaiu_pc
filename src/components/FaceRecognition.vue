<template>
    <van-dialog v-model:show="visible" :title="title" :close-on-click-overlay="false" :show-confirm-button="false"
        :show-cancel-button="false" class="face-dialog">
        <div class="face-container">
            <!-- 视频预览 -->
            <div class="video-wrapper" v-show="!isCaptured && !isVerifying">
                <video ref="videoRef" class="video-preview" autoplay playsinline
                    :class="{ 'facing': facingMode === 'user' }"></video>
                <div class="face-guide">
                    <div class="face-frame"></div>
                </div>
                <div class="guide-text">
                    <van-icon name="photograph" />
                    <span>请将面部置于框内</span>
                </div>
            </div>

            <!-- 拍摄预览 -->
            <div class="captured-preview" v-show="isCaptured && !isVerifying">
                <img :src="capturedImage" class="captured-img" />
                <div class="preview-actions">
                    <van-button round size="small" @click="retake">重新拍摄</van-button>
                </div>
            </div>

            <!-- 验证中 -->
            <div class="verifying" v-show="isVerifying">
                <van-loading size="48" />
                <p>人脸识别验证中...</p>
            </div>

            <!-- 控制按钮 -->
            <div class="action-buttons" v-if="!isVerifying">
                <van-button v-if="!isCaptured" round type="primary" class="capture-btn" @click="capture"
                    :loading="isCapturing">
                    <van-icon name="photograph" />
                    拍照识别
                </van-button>
                <van-button v-else round type="success" class="confirm-btn" @click="confirmAndProceed"
                    :loading="isUploading">
                    <van-icon name="success" />
                    验证通过，进入考勤
                </van-button>
            </div>

            <!-- 相机切换按钮（仅后置摄像头可用时显示） -->
            <div class="switch-camera" v-if="hasMultipleCameras && !isCaptured && !isVerifying">
                <van-button round size="small" @click="switchCamera" type="default">
                    <van-icon name="replay" />
                    切换摄像头
                </van-button>
            </div>
        </div>
    </van-dialog>
</template>

<script setup>
import { ref, onMounted, defineEmits, defineProps, onUnmounted, watch } from 'vue'
import { showToast } from 'vant'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    classId: {
        type: Number,
        required: true
    },
    className: {
        type: String,
        default: ''
    },
    uploadUrl: {
        type: String,
        default: ''
    }
})

const emit = defineEmits(['update:modelValue', 'success', 'cancel'])

const visible = ref(false)
const title = ref('人脸识别验证')
const videoRef = ref(null)
let stream = null
const isCapturing = ref(false)
const isCaptured = ref(false)
const capturedImage = ref('')
const isUploading = ref(false)
const isVerifying = ref(false)
const facingMode = ref('user') // 'user' 前置, 'environment' 后置
const hasMultipleCameras = ref(false)

// 监听 modelValue
watch(() => props.modelValue, (val) => {
    visible.value = val
    if (val) {
        startCamera()
    } else {
        stopCamera()
        resetState()
    }
})

// 重置状态
const resetState = () => {
    isCaptured.value = false
    capturedImage.value = ''
    isVerifying.value = false
    isUploading.value = false
}

// 开始摄像头
const startCamera = async () => {
    stopCamera()

    try {
        const constraints = {
            video: {
                facingMode: { exact: facingMode.value }
            }
        }

        stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (videoRef.value) {
            videoRef.value.srcObject = stream
        }
    } catch (err) {
        // 如果指定的摄像头不可用，尝试默认摄像头
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true })
            if (videoRef.value) {
                videoRef.value.srcObject = stream
            }
        } catch (fallbackErr) {
            console.error('无法获取摄像头:', fallbackErr)
            showToast({
                type: 'fail',
                message: '无法获取摄像头权限，请在设置中允许'
            })
            handleClose()
        }
    }
}

// 停止摄像头
const stopCamera = () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop())
        stream = null
    }
    if (videoRef.value) {
        videoRef.value.srcObject = null
    }
}

// 检查摄像头数量
const checkCameras = async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        hasMultipleCameras.value = videoDevices.length >= 2
    } catch (err) {
        console.error('检查摄像头失败:', err)
    }
}

// 切换摄像头
const switchCamera = () => {
    facingMode.value = facingMode.value === 'user' ? 'environment' : 'user'
    startCamera()
}

// 压缩图片
const compressImage = (base64, maxSize = 200, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const canvas = document.createElement('canvas')
            let width = img.width
            let height = img.height

            // 按比例缩放
            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height = (height * maxSize) / width
                    width = maxSize
                } else {
                    width = (width * maxSize) / height
                    height = maxSize
                }
            }

            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, width, height)

            // 压缩为 JPEG，质量可调
            const compressed = canvas.toDataURL('image/jpeg', quality)
            resolve(compressed)
        }
        img.onerror = reject
        img.src = base64
    })
}

// 拍照
const capture = async () => {
    if (!videoRef.value) return

    isCapturing.value = true

    try {
        const video = videoRef.value
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')

        // 可选：镜像翻转前置摄像头画面
        if (facingMode.value === 'user') {
            ctx.translate(canvas.width, 0)
            ctx.scale(-1, 1)
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        let imageData = canvas.toDataURL('image/jpeg', 0.8)

        // 压缩图片
        imageData = await compressImage(imageData, 300, 0.7)

        capturedImage.value = imageData
        isCaptured.value = true

        // 可选：自动上传验证
        await uploadAndVerify()
    } catch (err) {
        console.error('拍照失败:', err)
        showToast({ type: 'fail', message: '拍照失败，请重试' })
    } finally {
        isCapturing.value = false
    }
}

// 重新拍摄
const retake = () => {
    isCaptured.value = false
    capturedImage.value = ''
    startCamera()
}


// 上传并验证
const uploadAndVerify = async () => {
    if (!props.uploadUrl) {
        console.warn('上传地址未配置')
        return false
    }

    isUploading.value = true
    isVerifying.value = true

    try {
        // 将 base64 转换为 Blob
        const base64Data = capturedImage.value.split(',')[1]
        const blob = base64ToBlob(base64Data, 'image/jpeg')

        const formData = new FormData()
        formData.append('faceImage', blob, 'face.jpg')

        // 获取 token
        const token = localStorage.getItem('token')

        const response = await fetch(props.uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        })

        const result = await response.json()
        console.log('[人脸识别] 上传结果:', result)

        if (result.success) {
            showToast({ type: 'success', message: '人脸识别通过' })
            // 关键：关闭弹窗
            visible.value = false
            emit('update:modelValue', false)
            // 触发成功回调
            emit('success')
            return true
        } else {
            showToast({ type: 'fail', message: result.message || '人脸识别失败，请重试' })
            isVerifying.value = false
            isUploading.value = false
            retake()
            return false
        }
    } catch (err) {
        console.error('上传失败:', err)
        showToast({ type: 'fail', message: '网络错误，请重试' })
        isVerifying.value = false
        isUploading.value = false
        retake()
        return false
    }
}



// base64 转 Blob
const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
}
// 确认并跳转（修改）
const confirmAndProceed = async () => {
    // 如果还没上传验证，先上传验证
    if (!isVerifying.value) {
        const success = await uploadAndVerify()
        if (!success) return
    }

    // 验证通过，关闭弹窗并触发成功（实际上 uploadAndVerify 已经触发过了，这里防止重复）
    // 如果 uploadAndVerify 已经触发了 success，这里不需要再触发
}
// 关闭处理
const handleClose = () => {
    stopCamera()
    visible.value = false
    emit('update:modelValue', false)
    emit('cancel')
}

// 监听关闭
watch(visible, (newVal) => {
    if (!newVal) {
        stopCamera()
        resetState()
    }
})

onMounted(() => {
    checkCameras()
})

onUnmounted(() => {
    stopCamera()
})
</script>

<style scoped lang="scss">
.face-dialog {
    :deep(.van-dialog__content) {
        padding: 0;
    }

    :deep(.van-dialog__header) {
        padding: 16px 16px 8px;
    }
}

.face-container {
    padding: 16px 20px 24px;
}

.video-wrapper {
    position: relative;
    margin-bottom: 20px;
    border-radius: 16px;
    overflow: hidden;
    background: #1a1a2e;
}

.video-preview {
    width: 100%;
    height: 280px;
    object-fit: cover;

    &.facing {
        transform: scaleX(-1);
    }
}

.face-guide {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}

.face-frame {
    width: 200px;
    height: 200px;
    border: 2px solid rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
}

.guide-text {
    position: absolute;
    bottom: 12px;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: white;
    font-size: 12px;
    background: rgba(0, 0, 0, 0.5);
    padding: 6px 12px;
    border-radius: 20px;
    width: fit-content;
    margin: 0 auto;
}

.captured-preview {
    margin-bottom: 20px;
    border-radius: 16px;
    overflow: hidden;

    .captured-img {
        width: 100%;
        height: 280px;
        object-fit: cover;
    }

    .preview-actions {
        margin-top: 12px;
        text-align: center;
    }
}

.verifying {
    height: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: #f5f7fa;
    border-radius: 16px;
    margin-bottom: 20px;

    p {
        color: #666;
        font-size: 14px;
    }
}

.action-buttons {
    display: flex;
    justify-content: center;

    .capture-btn,
    .confirm-btn {
        padding: 0 32px;
        height: 44px;
        font-size: 16px;

        .van-icon {
            margin-right: 6px;
        }
    }
}

.switch-camera {
    text-align: center;
    margin-top: 16px;
}
</style>