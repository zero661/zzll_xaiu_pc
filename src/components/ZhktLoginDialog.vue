<template>
  <van-dialog v-model:show="dialogVisible" title="智慧教育平台登录" show-cancel-button confirm-button-text="登录"
    @confirm="handleLogin" @cancel="handleCancel" :confirm-button-disabled="loading">
    <div class="login-form">
      <van-field v-model="form.username" label="学号" placeholder="请输入学号" readonly />
      <van-field v-model="form.password" type="password" label="密码" placeholder="请输入密码" readonly />
      <div class="captcha-wrapper">
        <van-field v-model="form.captcha" label="验证码" placeholder="请输入验证码" :disabled="loading" />
        <div class="captcha-image" @click="loadCaptcha" v-if="!loading">
          <img v-if="captchaImage" :src="captchaImage" alt="验证码" />
          <span v-else>点击刷新</span>
        </div>
      </div>
    </div>
  </van-dialog>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits } from 'vue';
import { showLoadingToast, closeToast, showFailToast } from 'vant';
import { zhktApi } from '@/utils/zhktApi';
import CryptoJS from 'crypto-js';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  username: {
    type: String,
    default: ''
  },
  encryptedPassword: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:visible', 'login-success', 'login-fail', 'close']);

const AES_KEY = CryptoJS.enc.Utf8.parse('xa345678901234iu');
const AES_IV = CryptoJS.enc.Utf8.parse('1234xa789012iu56');

const dialogVisible = ref(false);
const loading = ref(false);
const captchaImage = ref('');
const captchaKey = ref(null);

const form = ref({
  username: '',
  password: '',
  captcha: ''
});

watch(() => props.visible, (val) => {
  dialogVisible.value = val;
  if (val) {
    resetForm();
    loadCaptcha();
  }
});

watch(dialogVisible, (val) => {
  if (!val && !loading.value) {
    emit('update:visible', false);
    emit('close');
  }
});

const resetForm = () => {
  form.value.username = props.username;
  form.value.password = decryptPassword(props.encryptedPassword);
  form.value.captcha = '';
};

const decryptPassword = (encrypted) => {
  if (!encrypted) return '';
  try {
    let padded = encrypted;
    while (padded.length % 4) padded += '=';
    const decrypted = CryptoJS.AES.decrypt(padded, AES_KEY, {
      iv: AES_IV,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.ZeroPadding
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error('密码解密失败:', e);
    return '';
  }
};

const loadCaptcha = async () => {
  if (loading.value) return;
  try {
    const result = await zhktApi.getCaptcha();
    if (result) {
      captchaImage.value = result.image;
      captchaKey.value = result.key;
    } else {
      showFailToast('获取验证码失败，请重试');
    }
  } catch (error) {
    console.error('获取验证码失败:', error);
    showFailToast('获取验证码失败');
  }
};

const handleCancel = () => {
  if (!loading.value) {
    dialogVisible.value = false;
  }
};

const handleLogin = async () => {
  if (!form.value.captcha) {
    showFailToast('请输入验证码');
    return;
  }

  loading.value = true;
  showLoadingToast({ message: '登录中...', forbidClick: true, duration: 0 });

  try {
    const result = await zhktApi.login(
      form.value.username,
      form.value.password,
      form.value.captcha,
      captchaKey.value
    );

    closeToast();

    if (result.success) {
      emit('login-success', { token: result.token });
      dialogVisible.value = false;
    } else {
      showFailToast(result.message || '登录失败');
      emit('login-fail', { message: result.message });
      loadCaptcha();
    }
  } catch (error) {
    closeToast();
    showFailToast(error.message || '登录失败，请重试');
    emit('login-fail', { message: error.message });
    loadCaptcha();
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped lang="scss">
.login-form {
  padding: 16px;

  .captcha-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;

    :deep(.van-field) {
      flex: 1;
    }

    .captcha-image {
      width: 120px;
      height: 44px;
      background: #f1f5f9;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      overflow: hidden;
      flex-shrink: 0;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      span {
        font-size: 12px;
        color: #64748b;
      }
    }
  }
}
</style>