const { getLogger } = require('../logger');

const logger = getLogger('Cấu Hình');

/**
 * Trình Quản Lý Cấu Hình - Tải và xác nhận các biến môi trường
 * Tất cả bí mật phải ở trong .env, không bao giờ hardcode
 */
class ConfigManager {
  constructor() {
    this.config = this._loadConfig();
    this._validateConfig();
  }

  /**
   * Tải cấu hình từ các biến môi trường
   */
  _loadConfig() {
    return {
      // Máy chủ
      PORT: parseInt(process.env.PORT, 10) || 3000,
      NODE_ENV: process.env.NODE_ENV || 'development',
      LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
      PUBLIC_URL: process.env.PUBLIC_URL || 'http://localhost:3000',

      // Cơ sở dữ liệu MySQL
      DATABASE: {
        HOST: process.env.DB_HOST || 'localhost',
        PORT: parseInt(process.env.DB_PORT, 10) || 3306,
        DATABASE: process.env.DB_NAME || 'AuctionWebsite',
        USER: process.env.DB_USER || 'root',
        PASSWORD: process.env.DB_PASSWORD || '',
        WAIT_FOR_CONNECTIONS: true,
        CONNECTION_LIMIT: parseInt(process.env.DB_POOL_LIMIT, 10) || 10,
        QUEUE_LIMIT: 0
      },

      // JWT/Xác thực
      JWT: {
        SECRET: process.env.JWT_SECRET || 'your-secret-key',
        EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h'
      },

      // Redis
      REDIS: {
        HOST: process.env.REDIS_HOST || 'localhost',
        PORT: parseInt(process.env.REDIS_PORT, 10) || 6379,
        PASSWORD: process.env.REDIS_PASSWORD || undefined,
        DB: parseInt(process.env.REDIS_DB, 10) || 0
      },

      // Phiên
      SESSION: {
        SECRET: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'session-secret',
        COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE === 'true',
        COOKIE_HTTP_ONLY: process.env.SESSION_COOKIE_HTTP_ONLY !== 'false'
      },

      // Email (Gmail SMTP)
      EMAIL: {
        SMTP_HOST: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
        SMTP_PORT: parseInt(process.env.EMAIL_SMTP_PORT, 10) || 587,
        USERNAME: process.env.EMAIL_USERNAME || '',
        PASSWORD: process.env.EMAIL_PASSWORD || '',
        FROM: process.env.EMAIL_FROM || 'noreply@auction.local'
      },

      // Thanh toán (Momo)
      PAYMENT: {
        MOMO_PARTNER_CODE: process.env.MOMO_PARTNER_CODE || '',
        MOMO_ACCESS_KEY: process.env.MOMO_ACCESS_KEY || '',
        MOMO_SECRET_KEY: process.env.MOMO_SECRET_KEY || '',
        MOMO_ENDPOINT: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create',
        RETURN_URL: `${process.env.PUBLIC_URL || 'http://localhost:5200'}/payment/success`,
        NOTIFY_URL: `${process.env.PUBLIC_URL || 'http://localhost:5200'}/api/payments/ipn`
      },

      // OAuth
      OAUTH: {
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
        GOOGLE_CALLBACK_URL: `${process.env.PUBLIC_URL || 'http://localhost:5200'}/api/auth/google/callback`,
        
        FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID || '',
        FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET || '',
        FACEBOOK_CALLBACK_URL: `${process.env.PUBLIC_URL || 'http://localhost:5200'}/api/auth/facebook/callback`
      },

      // Tải tệp
      UPLOAD: {
        MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880, // 5MB
        ALLOWED_EXTENSIONS: (process.env.ALLOWED_EXTENSIONS || 'jpg,jpeg,png,gif').split(','),
        UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads'
      }
    };
  }

  /**
   * Xác nhận các giá trị cấu hình quan trọng
   */
  _validateConfig() {
    const required = [
      'DATABASE.PASSWORD',
      'JWT.SECRET',
      'SESSION.SECRET'
    ];

    // Trong production, xác nhận tất cả các trường required
    if (this.config.NODE_ENV === 'production') {
      required.push(
        'EMAIL.USERNAME',
        'EMAIL.PASSWORD',
        'PAYMENT.MOMO_PARTNER_CODE',
        'OAUTH.GOOGLE_CLIENT_ID'
      );
    }

    for (const field of required) {
      const value = this._getNestedValue(field);
      if (!value) {
        const message = `Cấu hình quan trọng bị thiếu: ${field}`;
        logger.warn(message);
      }
    }
  }

  /**
   * Lấy giá trị cấu hình lồng nhau (ví dụ: "DATABASE.HOST")
   */
  _getNestedValue(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  
   //Lấy giá trị cấu hình
   
  get(path) {
    if (!path) return this.config;
    return this._getNestedValue(path);
  }

  /**
   * Lấy cấu hình kết nối cơ sở dữ liệu MySQL
   */
  getDatabaseConfig() {
    return {
      host: this.config.DATABASE.HOST,
      port: this.config.DATABASE.PORT,
      database: this.config.DATABASE.DATABASE,
      user: this.config.DATABASE.USER,
      password: this.config.DATABASE.PASSWORD,
      waitForConnections: this.config.DATABASE.WAIT_FOR_CONNECTIONS,
      connectionLimit: this.config.DATABASE.CONNECTION_LIMIT,
      queueLimit: this.config.DATABASE.QUEUE_LIMIT,
      enableKeepAlive: true, // Giữ nguyên
      keepAliveInitialDelay: 10000 // Sửa 'keepAliveInitialDelayMs' thành 'keepAliveInitialDelay' và đặt giá trị hợp lý
    };
  }

  /**
   * Lấy cấu hình kết nối Redis
   */
  getRedisConfig() {
    const config = {
      host: this.config.REDIS.HOST,
      port: this.config.REDIS.PORT,
      db: this.config.REDIS.DB
    };
    
    if (this.config.REDIS.PASSWORD) {
      config.password = this.config.REDIS.PASSWORD;
    }
    
    return config;
  }

  /**
   * Kiểm tra xem môi trường có phải là production không
   */
  isProduction() {
    return this.config.NODE_ENV === 'production';
  }

  /**
   * Kiểm tra xem môi trường có phải là development không
   */
  isDevelopment() {
    return this.config.NODE_ENV === 'development';
  }
}

// Singleton instance
let instance = null;

function getConfig() {
  if (!instance) {
    instance = new ConfigManager();
  }
  return instance;
}

module.exports = { ConfigManager, getConfig };
