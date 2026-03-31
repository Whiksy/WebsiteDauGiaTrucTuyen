const { requestLogger, responseTime } = require('./logger');
const { errorHandler, notFound } = require('./error');
const { authenticate, authorize, optionalAuth } = require('./auth');
module.exports = {
  requestLogger,
  responseTime,
  errorHandler,
  notFound,
  authenticate,
  authorize,
  optionalAuth
};