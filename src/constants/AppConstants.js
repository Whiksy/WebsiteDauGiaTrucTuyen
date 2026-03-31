/**
 * Application Constants and Enums
 */

const AUCTION_STATUS = {
  ACTIVE: 'ACTIVE',
  ENDED: 'Ended',
  CANCELLED: 'Cancelled',
  PROCESSING: 'Processing' // State when cron job is processing
};

const BID_STATUS = {
  ACTIVE: 'Active',
  CANCELLED: 'Cancelled'
};

const USER_ROLE = {
  ADMIN: 'Admin',
  SELLER: 'Seller',
  BUYER: 'Buyer',
  USER: 'User'
};

const PAYMENT_STATUS = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled'
};

const PAYMENT_METHOD = {
  MOMO: 'Momo',
  BANK_TRANSFER: 'BankTransfer',
  CREDIT_CARD: 'CreditCard'
};

const PRODUCT_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SOLD: 'Sold',
  ARCHIVED: 'Archived'
};

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

const REDIS_KEYS = {
  // Format: auction:{auctionId}:bids
  AUCTION_BIDS: (auctionId) => `auction:${auctionId}:bids`,
  // Format: auction:{auctionId}:highest
  AUCTION_HIGHEST_BID: (auctionId) => `auction:${auctionId}:highest`,
  // Format: product:{productId}:stock
  PRODUCT_STOCK: (productId) => `product:${productId}:stock`,
  // Format: user:{userId}:cache
  USER_CACHE: (userId) => `user:${userId}:cache`,
  // Format: session:{sessionId}
  SESSION_CACHE: (sessionId) => `session:${sessionId}`,
  // Format: lock:{resource}:{id}
  LOCK: (resource, id) => `lock:${resource}:${id}`
};

const CRON_JOBS = {
  // Process ended auctions every 30 seconds
  PROCESS_ENDED_AUCTIONS: '*/30 * * * * *',
  // Cleanup expired sessions every 1 hour
  CLEANUP_SESSIONS: '0 0 * * * *',
  // Send auction reminders daily at 8 AM
  SEND_REMINDERS: '0 8 * * *'
};

const VALIDATION = {
  // Email regex pattern
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Password min length
  PASSWORD_MIN_LENGTH: 8,
  // Bid increment multiplier (next bid must be at least 1.05x current)
  BID_INCREMENT_MULTIPLIER: 1.05,
  // Maximum file size (5MB)
  MAX_FILE_SIZE: 5242880,
  // Allowed image extensions
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif']
};

const SOCKET_EVENTS = {
  // Auction events
  AUCTION_UPDATED: 'auction:updated',
  BID_PLACED: 'bid:placed',
  AUCTION_ENDED: 'auction:ended',
  // User events
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left',
  // Error events
  ERROR: 'error',
  // Connection events
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected'
};

const ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_EXISTS: 'USER_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  AUCTION_NOT_FOUND: 'AUCTION_NOT_FOUND',
  AUCTION_ENDED: 'AUCTION_ENDED',
  BID_TOO_LOW: 'BID_TOO_LOW',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  DATABASE_ERROR: 'DATABASE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
};

module.exports = {
  AUCTION_STATUS,
  BID_STATUS,
  USER_ROLE,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  PRODUCT_STATUS,
  HTTP_STATUS,
  REDIS_KEYS,
  CRON_JOBS,
  VALIDATION,
  SOCKET_EVENTS,
  ERROR_CODES
};