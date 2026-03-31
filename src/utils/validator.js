const { VALIDATION, ERROR_CODES } = require('../constants/AppConstants');
const { ValidationError } = require('../errors');

/**
 * Input Validation Utilities
 */

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required and must be a string');
  }
  
  if (!VALIDATION.EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Invalid email format');
  }
  
  return email.toLowerCase().trim();
}

/**
 * Validate password strength
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required');
  }
  
  if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
    throw new ValidationError(
      `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`
    );
  }
  
  return password;
}

/**
 * Validate and sanitize name
 */
function validateName(name) {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Name is required');
  }
  
  const sanitized = name.trim();
  if (sanitized.length < 2 || sanitized.length > 100) {
    throw new ValidationError('Name must be between 2 and 100 characters');
  }
  
  return sanitized;
}

/**
 * Validate positive number
 */
function validatePositiveNumber(num, fieldName = 'Value') {
  const number = Number(num);
  
  if (isNaN(number)) {
    throw new ValidationError(`${fieldName} must be a valid number`);
  }
  
  if (number <= 0) {
    throw new ValidationError(`${fieldName} must be greater than 0`);
  }
  
  return number;
}

/**
 * Validate decimal amount
 */
function validateAmount(amount, fieldName = 'Amount') {
  const num = parseFloat(amount);
  
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a valid number`);
  }
  
  if (num < 0) {
    throw new ValidationError(`${fieldName} cannot be negative`);
  }
  
  return parseFloat(num.toFixed(2));
}

/**
 * Validate date is in the future
 */
function validateFutureDate(dateStr) {
  const date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date format');
  }
  
  if (date <= new Date()) {
    throw new ValidationError('Date must be in the future');
  }
  
  return date;
}

/**
 * Validate string is not empty
 */
function validateNotEmpty(value, fieldName = 'Field') {
  if (!value || (typeof value === 'string' && !value.trim())) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }
  
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Validate array has at least one element
 */
function validateNonEmptyArray(array, fieldName = 'Array') {
  if (!Array.isArray(array) || array.length === 0) {
    throw new ValidationError(`${fieldName} must not be empty`);
  }
  
  return array;
}

/**
 * Validate object has required fields
 */
function validateRequiredFields(obj, fields) {
  const missing = fields.filter(field => !obj[field]);
  
  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`
    );
  }
  
  return obj;
}

/**
 * Validate file upload
 */
function validateFileUpload(file) {
  if (!file) {
    throw new ValidationError('File is required');
  }
  
  if (file.size > VALIDATION.MAX_FILE_SIZE) {
    throw new ValidationError(
      `File size exceeds maximum of ${VALIDATION.MAX_FILE_SIZE} bytes`
    );
  }
  
  const ext = file.originalname.split('.').pop().toLowerCase();
  if (!VALIDATION.ALLOWED_EXTENSIONS.includes(ext)) {
    throw new ValidationError(
      `File type not allowed. Allowed: ${VALIDATION.ALLOWED_EXTENSIONS.join(', ')}`
    );
  }
  
  return file;
}

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validatePositiveNumber,
  validateAmount,
  validateFutureDate,
  validateNotEmpty,
  validateNonEmptyArray,
  validateRequiredFields,
  validateFileUpload
};
