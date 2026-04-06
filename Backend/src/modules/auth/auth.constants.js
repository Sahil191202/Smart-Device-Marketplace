// src/modules/auth/auth.constants.js
module.exports = {
  TOKEN_COOKIE_NAME: 'refreshToken',
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY_DAYS: 7,
  REFRESH_TOKEN_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
  EMAIL_VERIFY_EXPIRY_MS: 24 * 60 * 60 * 1000,        // 24 hours
  PASSWORD_RESET_EXPIRY_MS: 10 * 60 * 1000,            // 10 minutes
  MAX_REFRESH_TOKENS_PER_USER: 5,                       // max concurrent devices
  BCRYPT_HASH_ROUNDS: 10,                               // for token hashing (not passwords — bcrypt handles passwords in model)
};