const { getLogger } = require('../logger');
const { BaseError } = require('../errors');

const logger = getLogger('Middleware:ErrorHandler');

/**
 * Global error handling middleware
 * Should be the last middleware in the app
 */
const errorHandler = (error, req, res, next) => {
  logger.error(`Error: ${error.message}`, error);

  // Handle custom errors
  if (error instanceof BaseError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        name: error.name,
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
        statusCode: error.statusCode
      }
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        name: 'ValidationError',
        code: 'VALIDATION_ERROR',
        message: error.message,
        statusCode: 400
      }
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        name: 'JsonWebTokenError',
        code: 'INVALID_TOKEN',
        message: 'Invalid token',
        statusCode: 401
      }
    });
  }

  // Handle default error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: {
      name: error.name || 'Error',
      code: error.code || 'INTERNAL_ERROR',
      message,
      statusCode
    }
  });
};

/**
 * 404 Không tìm thấy middleware
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      name: 'NotFoundError',
      code: 'NOT_FOUND',
      message: `Route not found: ${req.originalUrl}`,
      statusCode: 404
    }
  });
};

module.exports = {
  errorHandler,
  notFound
};
