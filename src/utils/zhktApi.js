// utils/zhktApi.js
import axios from 'axios';
import CryptoJS from 'crypto-js';
import JSEncrypt from 'jsencrypt';

const ZHKT_API_BASE = process.env.VUE_APP_API_BASE_URL + '/zhkt';

class ZHKTAPI {
  constructor() {
    this.token = null;
    this.aesKey = null;
    this.aesIv = null;
    this.publicKey = null;
    this.sessionId = this.generateSessionId();
  }

  generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  generateRandomString(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  }

  getTimestamp() { return Math.floor(Date.now() / 1000); }

  // ------------------- RSA -------------------
  async getPublicKey() {
    try {
      const res = await axios.get(`${ZHKT_API_BASE}/auth/rsa/publicKey`, { validateStatus: () => true });
      if (res.data.code === 200 && res.data.data) {
        this.publicKey = res.data.data;
        return true;
      }
      return false;
    } catch { return false; }
  }

  rsaEncrypt(plainText) {
    if (!this.publicKey) return null;
    try {
      const encrypt = new JSEncrypt();
      encrypt.setPublicKey(`-----BEGIN PUBLIC KEY-----\n${this.publicKey}\n-----END PUBLIC KEY-----`);
      return encrypt.encrypt(plainText);
    } catch { return null; }
  }

  // ------------------- AES -------------------
  generateAesKeys() {
    this.aesKey = this.generateRandomString(16);
    this.aesIv = this.generateRandomString(16);
    this.saveAesKeysToLocal();
    return { key: this.aesKey, iv: this.aesIv };
  }

  saveAesKeysToLocal() {
    if (this.aesKey && this.aesIv) {
      localStorage.setItem('zhkt_aes_keys', JSON.stringify({
        key: this.aesKey, iv: this.aesIv, timestamp: Date.now(), sessionId: this.sessionId
      }));
    }
  }

  loadAesKeysFromLocal() {
    const data = localStorage.getItem('zhkt_aes_keys');
    if (!data) return false;
    try {
      const parsed = JSON.parse(data);
      if (Date.now() - parsed.timestamp <= 24 * 60 * 60 * 1000) {
        this.aesKey = parsed.key;
        this.aesIv = parsed.iv;
        this.sessionId = parsed.sessionId || this.generateSessionId();
        return true;
      } else {
        this.clearAesKeysFromLocal();
      }
    } catch { this.clearAesKeysFromLocal(); }
    return false;
  }

  clearAesKeysFromLocal() {
    localStorage.removeItem('zhkt_aes_keys');
    this.aesKey = this.aesIv = null;
  }

  aesEncrypt(plainText) {
    if (!this.aesKey || !this.aesIv) return null;
    const encrypted = CryptoJS.AES.encrypt(plainText, CryptoJS.enc.Utf8.parse(this.aesKey), {
      iv: CryptoJS.enc.Utf8.parse(this.aesIv), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.ZeroPadding
    });
    return encrypted.toString(); // .replace(/=/g, '');
  }

  // ------------------- 保存密钥到服务器（仅登录时调用）-------------------
  async saveAesKeys() {
    if (!this.token || !this.aesKey) return false;
    const encryptedKey = this.rsaEncrypt(this.aesKey);
    const encryptedIv = this.rsaEncrypt(this.aesIv);
    if (!encryptedKey || !encryptedIv) return false;
    try {
      const res = await axios.post(`${ZHKT_API_BASE}/account/save/aes/keys`, { key: encryptedKey, iv: encryptedIv }, {
        params: { token: this.token, _t: this.getTimestamp(), _nonce: this.generateRandomString(16) },
        validateStatus: () => true
      });
      return res.data.code === 200;
    } catch { return false; }
  }

  // ------------------- 验证码（仅登录时使用）-------------------
  async getCaptcha() {
    if (!this.aesKey || !this.aesIv) {
      if (!this.loadAesKeysFromLocal()) {
        this.generateAesKeys();
      }
    }
    const timestamp = this.getTimestamp();
    const key = `key=${timestamp}`;
    const _eup = this.aesEncrypt(key);
    const _nonce = this.generateRandomString(16);
    try {
      const res = await axios.get(`${ZHKT_API_BASE}/auth/randomImage`, {
        params: { _eup, _t: timestamp, key: timestamp, _nonce },
        validateStatus: () => true
      });
      if (res.data.code === 200 && res.data.data) {
        return { image: res.data.data, key: timestamp };
      }
      return null;
    } catch { return null; }
  }

  // ------------------- 登录 -------------------
  async login(username, password, captcha, captchaKey) {
    if (!(await this.getPublicKey())) return { success: false, message: '获取公钥失败' };

    if (!this.aesKey || !this.aesIv) {
      if (!this.loadAesKeysFromLocal()) {
        this.generateAesKeys();
      }
    }

    const encryptedPassword = this.rsaEncrypt(password);
    if (!encryptedPassword) return { success: false, message: '密码加密失败' };

    const loginData = { checkCode: captcha, checkKey: captchaKey, username, roleType: 0, password: encryptedPassword };
    const timestamp = this.getTimestamp();
    const _nonce = this.generateRandomString(16);

    try {
      const res = await axios.post(`${ZHKT_API_BASE}/auth/login`, loginData, {
        params: { _t: timestamp, _nonce }, validateStatus: () => true
      });
      if (res.data.code === 200 && res.data.data?.token) {
        this.token = res.data.data.token;
        await this.saveAesKeys();
        localStorage.setItem('zhkt_login_info', JSON.stringify({
          token: this.token, username, timestamp: Date.now(), sessionId: this.sessionId
        }));
        return { success: true, token: this.token };
      } else {
        return { success: false, message: res.data.msg || '登录失败' };
      }
    } catch (error) {
      return { success: false, message: error.message || '登录失败' };
    }
  }

  // ------------------- 检查本地登录状态（静默）-------------------
  checkLocalLogin() {
    const saved = localStorage.getItem('zhkt_login_info');
    if (!saved) return false;
    try {
      const info = JSON.parse(saved);
      if (Date.now() - info.timestamp > 24 * 60 * 60 * 1000 || !info.token) {
        localStorage.removeItem('zhkt_login_info');
        return false;
      }
      this.token = info.token;
      this.sessionId = info.sessionId || this.generateSessionId();
      if (!this.loadAesKeysFromLocal()) {
        this.logout();
        return false;
      }
      return true;
    } catch { return false; }
  }

  logout() {
    this.token = null;
    this.aesKey = null;
    this.aesIv = null;
    this.sessionId = this.generateSessionId();
    localStorage.removeItem('zhkt_login_info');
    this.clearAesKeysFromLocal();
  }

  // ------------------- 业务请求（静默，无任何提示）-------------------
// GET请求专用：参数转URL query字符串后加密
buildEupParams(params) {
  if (!this.aesKey || !this.aesIv) return null;
  const filtered = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== null && v !== undefined) filtered[k] = v;
  }
  const query = new URLSearchParams(filtered).toString();
  const encrypted = this.aesEncrypt(query);
  if (!encrypted) return null;
  let finalData = {
    _eup: encrypted,
    _t: this.getTimestamp(),
    _nonce: this.generateRandomString(16),
    token: this.token
  };
  console.log('GET请求参数加密前(query):', query);
  console.log('GET请求参数加密后:', encrypted);
  return finalData;
}

// POST请求专用：参数转JSON字符串后加密
buildEbParams(params) {
  if (!this.aesKey || !this.aesIv) return null;
  
  const filtered = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== null && v !== undefined) {
      filtered[k] = v;
    }
  }
  
  const jsonStr = JSON.stringify(filtered);
  const encrypted = this.aesEncrypt(jsonStr);
  if (!encrypted) return null;
  
  const finalData = {
    _eb: encrypted,
    _t: this.getTimestamp(),
    _nonce: this.generateRandomString(16),
    token: this.token
  };
  
  console.log('POST请求参数加密前(JSON):', jsonStr);
  console.log('POST请求参数加密后:', encrypted);
  
  return finalData;
}

async get(apiPath, params = {}) {
  if (!this.token) return { success: false, message: '未登录', needLogin: true };
  if (!this.aesKey || !this.aesIv) {
    if (!this.loadAesKeysFromLocal()) {
      return { success: false, message: '登录状态异常，请重新登录', needLogin: true };
    }
  }
  const eup = this.buildEupParams(params);
  if (!eup) return { success: false, message: '参数错误', needLogin: true };
  try {
    const res = await axios.get(`${ZHKT_API_BASE}${apiPath}`, { params: eup, validateStatus: () => true });
    if (res.data.code === 200) return { success: true, data: res.data.data };
    if (res.data.code === 401) {
      this.logout();
      return { success: false, message: res.data.msg || '登录已过期', needLogin: true };
    }
    return { success: false, message: res.data.msg || '请求失败' };
  } catch (error) {
    console.error('GET请求失败:', error);
    return { success: false, message: error.message || '网络错误' };
  }
}

async post(apiPath, data = {}) {
  if (!this.token) return { success: false, message: '未登录', needLogin: true };
  if (!this.aesKey || !this.aesIv) {
    if (!this.loadAesKeysFromLocal()) {
      return { success: false, message: '登录状态异常，请重新登录', needLogin: true };
    }
  }

  // 使用 buildEbParams（JSON字符串方式）
  const eb = this.buildEbParams(data);
  if (!eb) return { success: false, message: '参数错误', needLogin: true };

  // POST请求：加密后的数据放在请求体中
  const requestBody = { _eb: eb._eb };

  // URL参数
  const urlParams = {
    _t: eb._t,
    _nonce: eb._nonce,
    token: this.token
  };

  try {
    console.log('POST请求URL:', `${ZHKT_API_BASE}${apiPath}`);
    console.log('POST请求体:', requestBody);
    console.log('POST请求URL参数:', urlParams);
    const res = await axios.post(`${ZHKT_API_BASE}${apiPath}`, requestBody, {
      params: urlParams,
      validateStatus: () => true
    });

    console.log('POST响应:', res.data);

    if (res.data.code === 200) return { success: true, data: res.data.data };
    if (res.data.code === 401) {
      this.logout();
      return { success: false, message: res.data.msg || '登录已过期', needLogin: true };
    }
    return { success: false, message: res.data.msg || '请求失败' };
  } catch (error) {
    console.error('POST请求失败:', error);
    return { success: false, message: error.message || '网络错误' };
  }
}
}

export const zhktApi = new ZHKTAPI();