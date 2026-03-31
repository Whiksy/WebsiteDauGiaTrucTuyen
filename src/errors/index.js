/**
 * Central export for all error classes
 */
module.exports = {
  BaseError: require('./BaseError'),
  ValidationError: require('./ValidationError'),
  NotFoundError: require('./NotFoundError'),
  UnauthorizedError: require('./UnauthorizedError'),
  ForbiddenError: require('./ForbiddenError'),
  DatabaseError: require('./DatabaseError'),
  ConflictError: require('./ConflictError')
};
