const { getLogger } = require('../logger');

const logger = getLogger('Middleware:Logger');

/**
 * Middleware ghi nhật ký yêu cầu
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.info(`${req.method} ${req.path}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};

/**
 * Middleware ghi thời gian phản hồi
 */
const responseTime = (req, res, next) => {
  next();
};

module.exports = {
  requestLogger,
  responseTime
};
