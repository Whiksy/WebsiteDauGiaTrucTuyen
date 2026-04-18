const BaseError = require('./BaseError');

/**
 * Unauthorized Error - Used when user is not authenticated
 */
class UnauthorizedError extends BaseError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

module.exports = UnauthorizedError;
