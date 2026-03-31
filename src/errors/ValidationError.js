const BaseError = require('./BaseError');

/**
 * Validation Error - Used when input validation fails
 */
class ValidationError extends BaseError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      details: this.details
    };
  }
}

module.exports = ValidationError;
