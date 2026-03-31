const express = require('express');
const { authenticate } = require('../middleware');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { ServiceFactory } = require('../services/ServiceFactory');
const productService = ServiceFactory.getProductService();

const router = express.Router();
router.use(authenticate);

/**
 * @route   GET /api/seller/stats
 * @desc    Lấy thống kê tổng quan (Tổng SP, Phiên đang chạy, Đã kết thúc)
 */
router.get('/stats', async (req, res, next) => {
  try {
    const db = RepositoryFactory.getDatabaseManager();
    
    const res1 = await db.query('SELECT COUNT(*) as totalProducts FROM Products WHERE seller_id = ?', [req.userId]);
    const res2 = await db.query("SELECT COUNT(*) as activeAuctions FROM Auctions WHERE seller_id = ? AND status = 'ACTIVE'", [req.userId]);
    const res3 = await db.query("SELECT COUNT(*) as completedAuctions FROM Auctions WHERE seller_id = ? AND status IN ('ENDED', 'PROCESSING')", [req.userId]);
    
    const totalProducts = Array.isArray(res1[0]) ? res1[0][0]?.totalProducts : res1[0]?.totalProducts || 0;
    const activeAuctions = Array.isArray(res2[0]) ? res2[0][0]?.activeAuctions : res2[0]?.activeAuctions || 0;
    const completedAuctions = Array.isArray(res3[0]) ? res3[0][0]?.completedAuctions : res3[0]?.completedAuctions || 0;

    res.status(200).json({ success: true, data: { totalProducts, activeAuctions, completedAuctions } });
  } catch (error) { next(error); }
});

/**
 * @route   GET /api/seller/products
 * @desc    Lấy toàn bộ sản phẩm của người bán (để quản lý và tạo đấu giá)
 * @logic   Bổ sung logic kiểm tra sản phẩm có đang trong phiên đấu giá active không và còn tồn kho không.
 */
router.get('/products', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6; // 6 sản phẩm 1 trang cho đẹp
    const offset = (page - 1) * limit;
    const searchTerm = req.query.q || '';

    const { products, total } = await productService.getSellerProducts(req.userId, limit, offset, searchTerm); 
    
    res.status(200).json({ 
        success: true, data: products, 
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) { next(error); }
});

/**
 * @route   GET /api/seller/sold-items
 * @desc    Lấy danh sách các mặt hàng đã bán thành công
 */
router.get('/sold-items', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const searchTerm = req.query.q || '';

    const auctionService = ServiceFactory.getAuctionService();
    const { soldItems, total } = await auctionService.getSoldItemsBySeller(req.userId, limit, offset, searchTerm);

    res.status(200).json({ 
        success: true, data: soldItems,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) { next(error); }
});

/**
 * @route   GET /api/seller/auctions
 * @desc    Lấy danh sách các phiên đấu giá của người bán
 */
router.get('/auctions', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const searchTerm = req.query.q || '';

    const auctionService = ServiceFactory.getAuctionService();
    const { auctions, total } = await auctionService.getSellerAuctions(req.userId, limit, offset, searchTerm);

    res.status(200).json({ 
        success: true, data: auctions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) { next(error); }
});

/**
 * @route   DELETE /api/seller/auctions/:id
 * @desc    Xóa phiên đấu giá (Chỉ khi chưa có ai đặt giá)
 */
router.delete('/auctions/:id', async (req, res, next) => {
  try {
    const auctionService = ServiceFactory.getAuctionService();
    await auctionService.cancelAuction(parseInt(req.params.id), req.userId);
    res.status(200).json({ success: true, message: 'Đã xóa phiên đấu giá thành công.' });
  } catch (error) { next(error); }
});

/**
 * @route   POST /api/seller/auctions/:id/end
 * @desc    Kết thúc sớm phiên đấu giá (Cho mục đích Demo hoặc chốt sớm)
 */
router.post('/auctions/:id/end', async (req, res, next) => {
  try {
    const auctionService = ServiceFactory.getAuctionService();
    await auctionService.endAuctionEarly(parseInt(req.params.id), req.userId);
    res.status(200).json({ success: true, message: 'Đã kết thúc phiên đấu giá ngay lập tức!' });
  } catch (error) { next(error); }
});

/**
 * @route   POST /api/seller/auctions/:id/relist
 * @desc    Đăng lại phiên đấu giá bị thất bại
 */
router.post('/auctions/:id/relist', async (req, res, next) => {
  try {
    const { endTime } = req.body;
    const auctionService = ServiceFactory.getAuctionService();
    await auctionService.relistAuction(parseInt(req.params.id), req.userId, new Date(endTime));
    res.status(200).json({ success: true, message: 'Đã đăng lại phiên đấu giá thành công.' });
  } catch (error) { next(error); }
});

/**
 * @route   POST /api/seller/verify-pickup
 * @desc    Xác nhận giao hàng qua mã nhận hàng (AP-xxxxxx)
 */
router.post('/verify-pickup', async (req, res, next) => {
  try {
    const { pickupCode } = req.body;
    if (!pickupCode || !pickupCode.toUpperCase().startsWith('AP-')) {
      return res.status(400).json({ success: false, message: 'Mã nhận hàng không hợp lệ (Phải bắt đầu bằng AP-)' });
    }
    
    const auctionId = parseInt(pickupCode.toUpperCase().replace('AP-', ''), 10);
    if (isNaN(auctionId)) {
        return res.status(400).json({ success: false, message: 'Mã nhận hàng không hợp lệ' });
    }

    const auctionService = ServiceFactory.getAuctionService();
    const auction = await auctionService.getAuction(auctionId);

    if (!auction || auction.seller_id !== req.userId) {
      return res.status(403).json({ success: false, message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền.' });
    }

    const db = RepositoryFactory.getUserRepository();
    const existing = await db.executeQuery("SELECT id FROM Activities WHERE action = 'ITEM_DELIVERED' AND target_id = @aid", { aid: auctionId });
    if (existing.length > 0) return res.status(400).json({ success: false, message: 'Đơn hàng này đã được xác nhận giao thành công trước đó.' });

    await db.executeQuery("INSERT INTO Activities (user_id, action, target_type, target_id, description) VALUES (@uid, 'ITEM_DELIVERED', 'AUCTION', @aid, 'Người bán xác nhận đã giao hàng thành công bằng mã QR/nhập tay')", { uid: req.userId, aid: auctionId });
    res.status(200).json({ success: true, message: 'Xác nhận giao hàng thành công!' });
  } catch (error) { next(error); }
});

module.exports = router;