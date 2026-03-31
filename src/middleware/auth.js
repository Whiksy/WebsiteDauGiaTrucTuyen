const { getLogger } = require('../logger');
const { ServiceFactory } = require('../services/ServiceFactory');
const { UnauthorizedError, ForbiddenError } = require('../errors');

const logger = getLogger('Middleware:Auth');

/**
 * Middleware xác thực - Kiểm tra JWT token
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            throw new UnauthorizedError('No token provided');
        }

        const authService = ServiceFactory.getAuthService();
        const decoded = authService.verifyToken(token);

        req.user = decoded;
        req.userId = decoded.id;
        next();
    } catch (error) {
        logger.warn(`Authentication failed: ${error.message}`);
        next(error);
    }
};

/**
 * Middleware phân quyền - Kiểm tra người dùng có vai trò bắt buộc hay không
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User not authenticated');
      }

      // In real implementation, check user roles from database
      // For now, just allows authenticated users
      if (allowedRoles.length === 0) {
        return next();
      }

      // Check if user has one of the allowed roles
      // This requires fetching user roles from database
      next();
    } catch (error) {
      logger.warn(`Authorization failed: ${error.message}`);
      next(error);
    }
  };
};

/**
 * Middleware xác thực tùy chọn - Không lỗi khi không token
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const authService = ServiceFactory.getAuthService();
      const decoded = authService.verifyToken(token);
      req.user = decoded;
      req.userId = decoded.id;
    }

    next();
  } catch (error) {
    // Silently ignore auth errors for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};
