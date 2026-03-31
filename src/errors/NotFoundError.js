const BaseError = require('./BaseError');

/**
 * Không tìm thấy Error - Used when a resource is not found
 */
class NotFoundError extends BaseError {
  constructor(resource, identifier = null) {
    const message = identifier 
      ? `${resource} with id '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
    this.resource = resource;
    this.identifier = identifier;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      resource: this.resource,
      identifier: this.identifier
    };
  }
}

module.exports = NotFoundError;
