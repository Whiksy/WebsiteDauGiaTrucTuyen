const express = require('express');
const { authenticate } = require('../middleware');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { ServiceFactory } = require('../services/ServiceFactory');
const walletService = ServiceFactory.getWalletService();

const router = express.Router();

// Áp dụng middleware xác thực cho toàn bộ route này
router.use(authenticate);

/**
 * @route   GET /api/user/balance
 * @desc    Lấy thống kê số dư ví (Tổng Thu, Tổng Chi, Số dư)
 */
router.get('/balance', async (req, res, next) => {
  try {
    const stats = await walletService.getBalanceStats(req.userId);
    res.status(200).json({ success: true, data: stats });
  } catch (error) { next(error); }
});

/**
 * @route   GET /api/user/participating
 * @desc    Lấy danh sách các phiên đấu giá đang tham gia
 */
router.get('/participating', async (req, res, next) => {
  try {
    const auctionService = ServiceFactory.getAuctionService();
    const auctions = await auctionService.getParticipatingAuctions(req.userId);
    res.status(200).json({ success: true, data: auctions });
  } catch (error) { next(error); }
});

/**
 * @route   GET /api/user/won-auctions
 * @desc    Lấy danh sách hàng đã thắng
 */
router.get('/won-auctions', async (req, res, next) => {
  try {
    const auctionService = ServiceFactory.getAuctionService();
    const wonItems = await auctionService.getWonAuctions(req.userId);
    res.status(200).json({ success: true, data: wonItems });
  } catch (error) { next(error); }
});

/**
 * @route   POST /api/user/request-seller
 * @desc    Gửi yêu cầu nâng cấp tài khoản thành Seller
 */
router.post('/request-seller', async (req, res, next) => {
  try {
    const db = RepositoryFactory.getUserRepository();
    // Kiểm tra xem đã gửi yêu cầu chưa
    const existing = await db.executeQuery(
      "SELECT id FROM Activities WHERE user_id = @uid AND action = 'REQUEST_SELLER'", 
      { uid: req.userId }
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Bạn đã gửi yêu cầu trước đó, vui lòng chờ Admin duyệt.' });
    }

    await db.executeQuery(
      "INSERT INTO Activities (user_id, action, description) VALUES (@uid, 'REQUEST_SELLER', 'Người dùng yêu cầu nâng cấp lên Seller')",
      { uid: req.userId }
    );
    res.status(200).json({ success: true, message: 'Đã gửi yêu cầu thành công!' });
  } catch (error) { next(error); }
});

/**
 * @route   POST /api/user/withdraw
 * @desc    Gửi yêu cầu rút tiền về ví Momo
 */
router.post('/withdraw', async (req, res, next) => {
  try {
    const { amount, momoPhoneNumber } = req.body;
    const result = await walletService.withdraw(req.userId, amount, momoPhoneNumber);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    // Lỗi từ WalletService sẽ được errorHandler bắt và dịch
    next(error);
  }
});



/**
 * @route   GET /api/user/bids
 * @desc    Lấy lịch sử các lượt đặt giá của người dùng
 */
router.get('/bids', async (req, res, next) => {
  try {
    const biddingService = ServiceFactory.getBiddingService();
    const bids = await biddingService.getBidHistoryForUser(req.userId);
    res.status(200).json({ success: true, data: bids });
  } catch (error) { next(error); }
});

/**
 * @route   GET /api/user/transactions
 * @desc    Lấy lịch sử thanh toán / nạp tiền
 */
router.get('/transactions', async (req, res, next) => {
  try {
    const transactions = await walletService.getTransactions(req.userId);
    res.status(200).json({ success: true, data: transactions });
  } catch (error) { next(error); }
});

module.exports = router;