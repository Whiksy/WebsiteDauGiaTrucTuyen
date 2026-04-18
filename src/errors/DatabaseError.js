const BaseError = require('./BaseError');

/**
 * Database Error - Used for database operation failures
 */
class DatabaseError extends BaseError {
  constructor(message, originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      originalError: this.originalError?.message
    };
  }
}

module.exports = DatabaseError;
