const BaseError = require('./BaseError');

/**
 * Forbidden Error - Used when user is not authorized
 */
class ForbiddenError extends BaseError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

module.exports = ForbiddenError;
