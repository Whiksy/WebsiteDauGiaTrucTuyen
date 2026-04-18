const BaseError = require('./BaseError');

/**
 * Conflict Error - Used when resource already exists or state conflict
 */
class ConflictError extends BaseError {
  constructor(message, resource = null) {
    super(message, 409, 'CONFLICT');
    this.resource = resource;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      resource: this.resource
    };
  }
}

module.exports = ConflictError;
