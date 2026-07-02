import CryptoJS from 'crypto-js';

// AES密钥与IV（与后端保持一致）
const AES_KEY = CryptoJS.enc.Utf8.parse('xa345678901234iu');
const AES_IV  = CryptoJS.enc.Utf8.parse('1234xa789012iu56');

// 生成16位随机字符串 (_nonce)
export function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 获取当前秒级时间戳 (_t)
export function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

// AES加密，输出Base64并去除末尾的 '='
export function encryptAES(text) {
  const encrypted = CryptoJS.AES.encrypt(text, AES_KEY, {
    iv: AES_IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.ZeroPadding
  });
  let base64 = encrypted.toString();
  // 去除末尾的等号（后端要求）
  base64 = base64.replace(/=/g, '');
  return base64;
}

// 生成 _eup 参数（用于GET请求）
export function generateEup(queryString) {
  return encryptAES(queryString);
}

// 生成 _eb 参数（用于POST请求体）
export function generateEb(jsonData) {
  return encryptAES(JSON.stringify(jsonData));
}