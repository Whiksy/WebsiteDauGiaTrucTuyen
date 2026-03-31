/**
 * Central route registration
 */

const authRoutes = require('./auth');
const auctionRoutes = require('./auction');
const productRoutes = require('./product');
const bidRoutes = require('./bid');
const paymentRoutes = require('./payment');
const userRoutes = require('./user');
const sellerRoutes = require('./seller');
const adminRoutes = require('./admin');
const categoryRoutes = require('./category');
const imageRoutes = require('./image');
const { apiLimiter, authLimiter, bidLimiter } = require('../middleware/rateLimiter');

function registerRoutes(app) {
  // Áp dụng giới hạn chung cho tất cả API
  app.use('/api/', apiLimiter);

  // Áp dụng giới hạn khắt khe riêng cho nhóm Auth và Bid
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/bids', bidLimiter, bidRoutes);
  app.use('/api/auctions', auctionRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/payment', paymentRoutes); // Alias tương thích với Frontend cũ
  app.use('/api/user', userRoutes);
  app.use('/api/seller', sellerRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/images', imageRoutes);
}

module.exports = { registerRoutes };
