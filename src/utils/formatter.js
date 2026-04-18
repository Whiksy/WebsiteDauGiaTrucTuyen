/**
 * String and Value Formatters
 */

/**
 * Format amount as currency with decimals
 */
function formatCurrency(amount, decimals = 2) {
  if (amount === null || amount === undefined) return '0.00';
  return Number(amount).toFixed(decimals);
}

/**
 * Mask user name for privacy (show first name and last initial)
 * Example: "Nguyen Duy Le" -> "Nguyen *** L"
 */
function maskUserName(name) {
  if (!name) return '***';
  const parts = name.trim().split(' ');
  if (parts.length <= 1) {
    return parts[0].substring(0, 2) + '***';
  }
  return parts[0] + ' *** ' + parts[parts.length - 1].substring(0, 1);
}

/**
 * Format date to readable string
 */
function formatDate(date, format = 'DD/MM/YYYY HH:mm') {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  
  const pad = (num) => String(num).padStart(2, '0');
  
  const replacements = {
    'YYYY': date.getFullYear(),
    'MM': pad(date.getMonth() + 1),
    'DD': pad(date.getDate()),
    'HH': pad(date.getHours()),
    'mm': pad(date.getMinutes()),
    'ss': pad(date.getSeconds())
  };
  
  let result = format;
  Object.entries(replacements).forEach(([key, value]) => {
    result = result.replace(key, value);
  });
  
  return result;
}

/**
 * Format time remaining (e.g., "2 days 3 hours")
 */
function formatTimeRemaining(endTime) {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end - now;
  
  if (diff <= 0) return 'Ended';
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Truncate string with ellipsis
 */
function truncate(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Capitalize first letter of string
 */
function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Convert string to slug (for URLs)
 */
function toSlug(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Chuyển đổi các trường Buffer (ảnh) trong một đối tượng thành chuỗi Base64 (utf8)
 * @param {object} obj - Đối tượng cần xử lý
 */
function parseBuffer(obj) {
  if (!obj) return obj;
  const fieldsToConvert = ['productImage', 'sellerAvatar', 'highestBidderAvatar', 'Thumbnail', 'Avatar', 'image'];
  fieldsToConvert.forEach(field => {
    if (obj[field] && Buffer.isBuffer(obj[field])) {
      obj[field] = obj[field].toString('utf8');
    }
  });
  if (obj.images && Buffer.isBuffer(obj.images)) obj.images = obj.images.toString('utf8').split(',');
  return obj;
}

/**
 * Định dạng số thành tiền tệ VND (server-side)
 * @param {number} num - Số cần định dạng
 */
function formatVND(num) {
  try {
    if (isNaN(Number(num))) return num;
    return Number(num).toLocaleString('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  } catch (e) {
    return num + ' ₫';
  }
}

/**
 * Chuyển đổi chuỗi VND (ví dụ: "100.000 ₫") thành số (server-side)
 * @param {string} str - Chuỗi cần chuyển đổi
 */
function parseVND(str) {
  if (!str || typeof str !== 'string') return 0;
  return Number(str.replace(/[^0-9]/g, ''));
}

module.exports = {
  formatCurrency,
  maskUserName,
  formatDate,
  formatTimeRemaining,
  truncate,
  capitalize,
  toSlug,
  formatVND,
  parseVND,
  parseBuffer
};
