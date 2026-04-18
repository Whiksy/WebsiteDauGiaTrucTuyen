/**
 * Dịch Vụ Ghi Nhật Ký - Ghi nhật ký tập trung với mức độ và định dạng
 * Hỗ trợ: DEBUG, INFO, WARN, ERROR
 */
class Logger {
  constructor(context = 'Ứng Dụng') {
    this.context = context;
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  }

  /**
   * Kiểm tra xem mức độ ghi nhật ký có được bật không
   */
  _shouldLog(level) {
    const currentLevelValue = this.levels[this.logLevel] || 1;
    const messageLevelValue = this.levels[level] || 1;
    return messageLevelValue >= currentLevelValue;
  }

  /**
   * Định dạng thông báo nhật ký với dấu thời gian và bối cảnh
   */
  _format(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${this.context}]`;
    const msg = `${prefix} ${message}`;
    
    return data ? `${msg}\n${JSON.stringify(data, null, 2)}` : msg;
  }

  /**
   * Ghi nhật ký mức DEBUG
   */
  debug(message, data = null) {
    if (this._shouldLog('DEBUG')) {
      console.log(this._format('DEBUG', message, data));
    }
  }

  /**
   * Ghi nhật ký mức INFO
   */
  info(message, data = null) {
    if (this._shouldLog('INFO')) {
      console.log(this._format('INFO', message, data));
    }
  }

  /**
   * Ghi nhật ký mức WARN (cảnh báo)
   */
  warn(message, data = null) {
    if (this._shouldLog('WARN')) {
      console.warn(this._format('WARN', message, data));
    }
  }

  /**
   * Ghi nhật ký mức ERROR (lỗi)
   */
  error(message, error = null) {
    if (this._shouldLog('ERROR')) {
      if (error instanceof Error) {
        console.error(this._format('ERROR', message, { 
          name: error.name, 
          message: error.message, 
          stack: error.stack 
        }));
      } else {
        console.error(this._format('ERROR', message, error));
      }
    }
  }

  /**
   * Lấy logger con với bối cảnh mở rộng
   */
  getChild(childContext) {
    const child = new Logger(`${this.context}:${childContext}`);
    child.logLevel = this.logLevel;
    return child;
  }
}

module.exports = Logger;
