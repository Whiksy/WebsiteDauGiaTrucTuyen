const mysql = require('mysql2/promise');
const { getConfig } = require('../config');
const { getLogger } = require('../logger');

const logger = getLogger('Cơ Sở Dữ Liệu');

/**
 * Trình Quản Lý Kết Nối Cơ Sở Dữ Liệu - Quản lý kết nối MySQL
 * Triển khai kết nối pool và xử lý lỗi
 */
class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.config = getConfig();
  }

  /**
   * Khởi tạo kết nối cơ sở dữ liệu
   */
  async connect() {
    if (this.isConnected) {
      logger.debug('Cơ sở dữ liệu đã kết nối');
      return this.pool;
    }

    try {
      const dbConfig = this.config.getDatabaseConfig();
      logger.info('Đang kết nối đến MySQL...', dbConfig);
      
      this.pool = await mysql.createPool(dbConfig);
      this.isConnected = true;
      
      logger.info('✅ Kết nối cơ sở dữ liệu thành công');
      return this.pool;
    } catch (error) {
      logger.error('❌ Kết nối cơ sở dữ liệu thất bại', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Lấy kết nối pool hiện tại
   */
  getPool() {
    if (!this.isConnected || !this.pool) {
      throw new Error('Cơ sở dữ liệu chưa kết nối. Gọi connect() trước');
    }
    return this.pool;
  }

  /**
   * Kiểm tra xem cơ sở dữ liệu có kết nối không
   */
  isReady() {
    return this.isConnected && this.pool;
  }

  /**
   * Đóng kết nối cơ sở dữ liệu
   */
  async disconnect() {
    if (this.pool) {
      try {
        await this.pool.end();
        this.isConnected = false;
        logger.info('Kết nối cơ sở dữ liệu đã đóng');
      } catch (error) {
        logger.error('Lỗi khi đóng kết nối cơ sở dữ liệu', error);
      }
    }
  }

  /**
   * Thực thi truy vấn SQL thô
   */
  async query(sqlString, params = []) {
    try {
      const connection = await this.pool.getConnection();
      try {
        const [rows] = await connection.query(sqlString, params);
        return rows;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('Lỗi thực thi truy vấn', error);
      throw error;
    }
  }

  /**
   * Lấy một dòng từ truy vấn
   */
  async queryOne(sqlString, params = []) {
    const rows = await this.query(sqlString, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Thực thi truy vấn insertion/update/delete
   */
  async execute(sqlString, params = []) {
    try {
      const connection = await this.pool.getConnection();
      try {
        const [result] = await connection.execute(sqlString, params);
        return result;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('Lỗi thực thi lệnh', error);
      throw error;
    }
  }

  /**
   * Bắt đầu giao dịch
   */
  async beginTransaction() {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    return connection;
  }

  /**
   * Lấy một kết nối riêng (không dùng khi thường)
   */
  async getConnection() {
    return await this.pool.getConnection();
  }
}

// Instance singleton
let instance = null;

function getDatabaseManager() {
  if (!instance) {
    instance = new DatabaseManager();
  }
  return instance;
}

class DBRequest {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.params = {};
    this.order = [];
  }

  input(name, value) {
    if (!(name in this.params)) {
      this.order.push(name);
    }
    this.params[name] = value;
    return this;
  }

  _prepareQuery(query) {
    const values = [];
    const prepared = query.replace(/@([a-zA-Z0-9_]+)/g, (_, key) => {
      if (!(key in this.params)) {
        throw new Error(`Missing parameter: ${key}`);
      }
      values.push(this.params[key]);
      return '?';
    });
    return { sql: prepared, values };
  }

  async query(query) {
    const { sql, values } = this._prepareQuery(query);
    const result = await this.dbManager.query(sql, values);

    if (Array.isArray(result)) {
      return {
        recordset: result,
        rowsAffected: [0],
        insertId: null
      };
    }

    return {
      recordset: [],
      rowsAffected: [result.affectedRows || 0],
      insertId: result.insertId || null
    };
  }

  async execute(query) {
    const { sql, values } = this._prepareQuery(query);
    const result = await this.dbManager.execute(sql, values);
    return {
      recordset: [],
      rowsAffected: [result.affectedRows || 0],
      insertId: result.insertId || null
    };
  }
}

DatabaseManager.prototype.createRequest = function() {
  if (!this.isReady()) {
    throw new Error('Database not connected. Call connect() first.');
  }
  return new DBRequest(this);
};

module.exports = { DatabaseManager, getDatabaseManager };
