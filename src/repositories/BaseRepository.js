const { getLogger } = require('../logger');
const { DatabaseError } = require('../errors');

/**
 * Base Repository Class - Provides common CRUD operations
 * All repositories should extend this class
 */
class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    const { RepositoryFactory } = require('./RepositoryFactory');
    this.db = RepositoryFactory.getDatabaseManager();
    this.logger = getLogger(`Repository:${tableName}`);
  }

  /**
   * Find record by ID
   */
  async findById(id) {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE id = @id`;
      const request = this.db.createRequest();
      request.input('id', id);
      
      const result = await request.query(query);
      return result.recordset[0] || null;
    } catch (error) {
      this.logger.error(`Error finding by ID ${id}`, error);
      throw new DatabaseError(`Failed to find ${this.tableName}`, error);
    }
  }

  /**
   * Find all records (with optional filters)
   */
  async findAll(filters = {}, limit = 100, offset = 0) {
    try {
      let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
      const request = this.db.createRequest();

      // Build WHERE clause from filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query += ` AND ${key} = @${key}`;
          request.input(key, value);
        }
      });

      query += ` ORDER BY id DESC LIMIT @offset, @limit`;
      request.input('offset', offset);
      request.input('limit', limit);

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      this.logger.error('Error finding all records', error);
      throw new DatabaseError(`Failed to fetch ${this.tableName}`, error);
    }
  }

  /**
   * Find records by condition
   */
  async findByCriteria(whereClause, params = {}) {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE ${whereClause}`;
      const request = this.db.createRequest();

      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      this.logger.error('Error finding by criteria', error);
      throw new DatabaseError(`Failed to fetch ${this.tableName}`, error);
    }
  }

  /**
   * Count total records
   */
  async count(filters = {}) {
    try {
      let query = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE 1=1`;
      const request = this.db.createRequest();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query += ` AND ${key} = @${key}`;
          request.input(key, value);
        }
      });

      const result = await request.query(query);
      return result.recordset[0].total;
    } catch (error) {
      this.logger.error('Error counting records', error);
      throw new DatabaseError(`Failed to count ${this.tableName}`, error);
    }
  }

  /**
   * Create new record
   */
  async create(data) {
    try {
      const columns = Object.keys(data).join(', ');
      const values = Object.keys(data).map((key) => `@${key}`).join(', ');
      
      const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${values})`;

      const request = this.db.createRequest();
      Object.entries(data).forEach(([key, value]) => {
        request.input(key, value);
      });

      const result = await request.execute(query);
      const newId = result.insertId;

      this.logger.debug(`Record created with ID: ${newId}`);
      return newId;
    } catch (error) {
      this.logger.error('Error creating record', error);
      throw new DatabaseError(`Failed to create ${this.tableName}`, error);
    }
  }

  /**
   * Update record by ID
   */
  async update(id, data) {
    try {
      const setClause = Object.keys(data)
        .map((key) => `${key} = @${key}`)
        .join(', ');

      const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = @id`;

      const request = this.db.createRequest();
      request.input('id', id);
      Object.entries(data).forEach(([key, value]) => {
        request.input(key, value);
      });

      const result = await request.execute(query);
      this.logger.debug(`Record ${id} updated`);
      return result.rowsAffected[0];
    } catch (error) {
      this.logger.error(`Error updating record ${id}`, error);
      throw new DatabaseError(`Failed to update ${this.tableName}`, error);
    }
  }

  /**
   * Delete record by ID
   */
  async delete(id) {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE id = @id`;
      const request = this.db.createRequest();
      request.input('id', id);

      const result = await request.execute(query);
      this.logger.debug(`Record ${id} deleted`);
      return result.rowsAffected[0];
    } catch (error) {
      this.logger.error(`Error deleting record ${id}`, error);
      throw new DatabaseError(`Failed to delete ${this.tableName}`, error);
    }
  }

  /**
   * Begin transaction
   */
  async beginTransaction() {
    try {
      const connection = await this.db.getConnection();
      await connection.beginTransaction();
      this.logger.debug('Transaction started');
      return connection;
    } catch (error) {
      this.logger.error('Error starting transaction', error);
      throw new DatabaseError('Failed to start transaction', error);
    }
  }

  /**
   * Commit transaction
   */
  async commit(connection) {
    try {
      await connection.commit();
      connection.release();
      this.logger.debug('Transaction committed');
    } catch (error) {
      this.logger.error('Error committing transaction', error);
      throw new DatabaseError('Failed to commit transaction', error);
    }
  }

  /**
   * Rollback transaction
   */
  async rollback(connection) {
    try {
      await connection.rollback();
      connection.release();
      this.logger.debug('Transaction rolled back');
    } catch (error) {
      this.logger.error('Error rolling back transaction', error);
    }
  }

  /**
   * Execute raw query (use with caution)
   */
  async executeQuery(query, params = {}) {
    try {
      const request = this.db.createRequest();
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      this.logger.error('Error executing query', error);
      throw new DatabaseError('Query execution failed', error);
    }
  }
}

module.exports = BaseRepository;
