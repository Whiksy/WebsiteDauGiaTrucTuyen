const express = require('express');
const { authenticate, authorize } = require('../middleware');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { ServiceFactory } = require('../services/ServiceFactory');
const adminService = ServiceFactory.getAdminService();
const router = express.Router();

// Chỉ Admin mới được truy cập các API này
router.use(authenticate);
// router.use(authorize(['Admin'])); // Sẽ kích hoạt sau khi bạn tinh chỉnh middleware authorize

/**
 * @route   GET /api/admin/stats
 * @desc    Lấy dữ liệu thống kê tổng quan cho Bảng điều khiển
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) { next(error); }
});
/**
 * @route   GET /api/admin/users
 * @desc    Lấy danh sách người dùng
 */
router.get('/users', async (req, res, next) => {
  try {
    const db = RepositoryFactory.getUserRepository();
    const users = await adminService.getAllUsersWithRoles();
    res.status(200).json({ success: true, data: users });
  } catch (error) { next(error); }
});

/**
 * @route   GET /api/admin/seller-requests
 * @desc    Lấy danh sách yêu cầu nâng cấp lên Seller
 */
router.get('/seller-requests', async (req, res, next) => {
  try {
    const requests = await adminService.getSellerRequests();
    res.status(200).json({ success: true, data: requests });
  } catch (error) { next(error); }
});

/**
 * @route   POST /api/admin/approve-seller/:id
 * @desc    Duyệt yêu cầu Seller (id của bảng Activities)
 */
router.post('/approve-seller/:id', async (req, res, next) => {
  try {
    const activityId = parseInt(req.params.id);
    await adminService.approveSellerRequest(activityId);
    res.status(200).json({ success: true, message: 'Đã cấp quyền Người bán thành công!' });
  } catch (error) { next(error); }
});

// --- CÁC API THAO TÁC NGƯỜI DÙNG ---
router.put('/users/:id', async (req, res, next) => {
  try {
    const { role } = req.body;
    const userId = parseInt(req.params.id);
    await adminService.updateUserRole(userId, role);
    res.status(200).json({ success: true, message: 'Cập nhật vai trò người dùng thành công' });
  } catch (err) { next(err); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    await adminService.deleteUser(userId);
    res.status(200).json({ success: true, message: 'Xóa người dùng thành công' });
  } catch (err) { next(err); }
});

// --- QUẢN LÝ SẢN PHẨM ---
router.get('/products', async (req, res, next) => {
  try {
    const db = RepositoryFactory.getUserRepository();
    const products = await adminService.getAllProductsForAdmin();
    res.status(200).json({ success: true, data: products });
  } catch (err) { next(err); }
});

router.get('/products/:id', async (req, res, next) => {
  try {
    const db = RepositoryFactory.getUserRepository();
    const product = await ServiceFactory.getProductService().getProduct(parseInt(req.params.id));
    res.status(200).json({ success: true, data: product });
  } catch (err) { next(err); }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    await ServiceFactory.getProductService().deleteProduct(productId, req.userId); // Admin can delete any product, but for now, we'll pass req.userId
    res.status(200).json({ success: true, message: 'Xóa sản phẩm thành công' });
  } catch (err) { next(err); }
});

// --- QUẢN LÝ ĐẤU GIÁ ---
router.get('/auctions', async (req, res, next) => {
  try {
    const searchTerm = req.query.q || '';
    const auctions = await adminService.getAllAuctionsForAdmin(searchTerm);
    res.status(200).json({ success: true, data: auctions });
  } catch (err) { next(err); }
});

router.get('/auctions/:id', async (req, res, next) => {
  try {
    const auctionId = parseInt(req.params.id);
    const auction = await ServiceFactory.getAuctionService().getAuction(auctionId);
    const bids = await ServiceFactory.getBiddingService().getAuctionBidHistoryDetails(auctionId);
    res.status(200).json({ success: true, data: { info: auction, bids } });
  } catch (err) { next(err); }
});

router.post('/auctions/:id/end', async (req, res, next) => {
  try {
    const auctionId = parseInt(req.params.id);
    await adminService.endAuctionByAdmin(auctionId);
    res.status(200).json({ success: true, message: 'Đã kết thúc phiên đấu giá' });
  } catch (err) { next(err); }
});

// --- QUẢN LÝ DANH MỤC ---
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await ServiceFactory.getCategoryService().getAllCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (err) { next(err); }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    await ServiceFactory.getCategoryService().createCategory(name, description);
    res.status(201).json({ success: true, message: 'Thêm danh mục thành công' });
  } catch (err) { next(err); }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const categoryId = parseInt(req.params.id);
    await ServiceFactory.getCategoryService().updateCategory(categoryId, name, description);
    res.status(200).json({ success: true, message: 'Cập nhật danh mục thành công' });
  } catch (err) { next(err); }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    await ServiceFactory.getCategoryService().deleteCategory(categoryId);
    res.status(200).json({ success: true, message: 'Xóa danh mục thành công' });
  } catch (err) { next(err); }
});

// --- QUẢN LÝ RÚT TIỀN ---
router.get('/withdrawals', async (req, res, next) => {
  try {
    const data = await adminService.getPendingWithdrawals();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/withdrawals/:id/process', async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.id);
    await adminService.processWithdrawal(paymentId, req.body.action);
    res.status(200).json({ success: true, message: 'Đã xử lý yêu cầu rút tiền' });
  } catch (err) { next(err); }
});

module.exports = router;