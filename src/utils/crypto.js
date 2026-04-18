const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * Cryptography and Security Utilities
 */

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
function generateToken(payload, secret, expiresIn = '24h') {
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify JWT token
 */
function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

/**
 * Generate random token (for email verification, password reset)
 */
function generateRandomToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash email for verification
 */
function hashEmail(email) {
  return crypto
    .createHash('sha256')
    .update(email.toLowerCase())
    .digest('hex');
}

/**
 * Generate HMAC signature (for payment verification)
 */
function generateHMAC(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
}

/**
 * Encrypt sensitive data
 */
function encryptData(data, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(encryptionKey, 'hex'),
    iv
  );
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data
 */
function decryptData(encryptedData, encryptionKey) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(encryptionKey, 'hex'),
    iv
  );
  
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate unique ID
 */
function generateUniqueId() {
  return crypto.randomUUID();
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateRandomToken,
  hashEmail,
  generateHMAC,
  encryptData,
  decryptData,
  generateUniqueId
};
