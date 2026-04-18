const { getLogger } = require('../logger');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { NotFoundError, ValidationError } = require('../errors');
const { AUCTION_STATUS } = require('../constants/AppConstants');
const { parseBuffer } = require('../utils/formatter');

/**
 * Admin Service - Handles all administrative operations
 */
class AdminService {
  constructor() {
    this.userRepository = RepositoryFactory.getUserRepository();
    this.productRepository = RepositoryFactory.getProductRepository();
    this.auctionRepository = RepositoryFactory.getAuctionRepository();
    this.paymentRepository = RepositoryFactory.getPaymentRepository();
    this.activityRepository = RepositoryFactory.getActivityRepository();
    this.categoryRepository = RepositoryFactory.getCategoryRepository();
    this._auctionService = null;
    this._productService = null;
    this.logger = getLogger('AdminService');
    this.db = RepositoryFactory.getDatabaseManager();
  }

  // Tải trễ AuctionService
  get auctionService() {
    if (!this._auctionService) {
      const { ServiceFactory } = require('./ServiceFactory');
      this._auctionService = ServiceFactory.getAuctionService();
    }
    return this._auctionService;
  }

  // Tải trễ ProductService
  get productService() {
    if (!this._productService) {
      const { ServiceFactory } = require('./ServiceFactory');
      this._productService = ServiceFactory.getProductService();
    }
    return this._productService;
  }
  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    try {
      // TỐI ƯU: Gộp 4 câu truy vấn đếm thành 1 để tăng tốc độ load dashboard
      const [counts] = await this.db.query(`
        SELECT
          (SELECT COUNT(*) FROM Users) as totalUsers,
          (SELECT COUNT(*) FROM Products) as totalProducts,
          (SELECT COUNT(*) FROM Auctions WHERE status = 'ACTIVE') as activeAuctions,
          (SELECT SUM(amount) FROM Payments WHERE status='SUCCESS' AND type='PAYMENT') as totalRevenue
      `);

      const auctionStatuses = await this.db.query("SELECT status, COUNT(*) as cnt FROM Auctions GROUP BY status");
      const statusChart = (auctionStatuses || []).map(row => {
        let statusName = row.status;
        // Chuyển đổi tên trạng thái nếu cần
        return { Status: statusName, Count: row.cnt };
      });

      const revenueData = await this.db.query(`
        SELECT DATE_FORMAT(created_at, '%m/%Y') as Month, SUM(amount) as Revenue
        FROM Payments 
        WHERE status='SUCCESS' AND type='PAYMENT'
        GROUP BY DATE_FORMAT(created_at, '%m/%Y')
        ORDER BY MIN(created_at) DESC
        LIMIT 6
      `);
      const revenueChart = revenueData.length > 0 ? revenueData.reverse() : [{ Month: 'Tháng này', Revenue: 0 }];

      const recentEnded = await this.db.query(`
        SELECT a.id, p.name as Title, a.current_price as CurrentBid, u.full_name as Winner
        FROM Auctions a
        JOIN Products p ON a.product_id = p.id
        LEFT JOIN Users u ON a.winner_id = u.id
        WHERE a.status = 'ENDED'
        ORDER BY a.end_date DESC
        LIMIT 5
      `);

      const activity = await this.db.query("SELECT 'New User' as Type, description as Description, created_at as CreatedAt FROM Activities ORDER BY created_at DESC LIMIT 5");

      return {
        counts: { totalUsers: counts.totalUsers, totalProducts: counts.totalProducts, activeAuctions: counts.activeAuctions, totalRevenue: counts.totalRevenue },
        activity: activity.length > 0 ? activity : [
          { Type: 'Hệ thống', Description: 'Chưa có hoạt động nào', CreatedAt: new Date() }
        ],
        recentEnded,
        revenueChart,
        statusChart: statusChart.length > 0 ? statusChart : [{ Status: 'Chưa có', Count: 1 }]
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard stats', error);
      throw error;
    }
  }

  /**
   * Get all users with their roles
   */
  async getAllUsersWithRoles() {
    try {
      const users = await this.userRepository.executeQuery(`
        SELECT u.id, u.full_name as name, u.email, u.avatar, u.is_active, GROUP_CONCAT(r.name) as role 
        FROM Users u 
        LEFT JOIN UserRoles ur ON u.id = ur.user_id 
        LEFT JOIN Roles r ON ur.role_id = r.id 
        GROUP BY u.id
      `);

      return users.map(u => {
        let roleStr = u.role || 'User';
        roleStr = roleStr.split(',')
          .map(r => r.trim().charAt(0).toUpperCase() + r.trim().slice(1).toLowerCase())
          .join(', ');
        return { 
          ...u, 
          role: roleStr,
          avatar: u.avatar && Buffer.isBuffer(u.avatar) ? u.avatar.toString('utf8') : u.avatar
        };
      });
    } catch (error) {
      this.logger.error('Failed to get all users with roles', error);
      throw error;
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(userId, newRole) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new NotFoundError('User', userId);

      await this.userRepository.executeQuery('DELETE FROM UserRoles WHERE user_id = @id', { id: userId });
      await this.userRepository.executeQuery("INSERT INTO UserRoles (user_id, role_id) SELECT @id, id FROM Roles WHERE name = @role", { id: userId, role: newRole.toUpperCase() });
      this.logger.info(`User ${userId} role updated to ${newRole}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update user ${userId} role to ${newRole}`, error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new NotFoundError('User', userId);
      await this.userRepository.delete(userId);
      this.logger.info(`User ${userId} deleted`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get seller upgrade requests
   */
  async getSellerRequests() {
    try {
      const requests = await this.activityRepository.executeQuery(`
        SELECT a.id as Id, u.id as UserId, u.full_name as Name, u.email as Email, u.avatar as Avatar, a.created_at as CreatedAt
        FROM Activities a
        JOIN Users u ON a.user_id = u.id
        WHERE a.action = 'REQUEST_SELLER'
      `);

      return requests.map(req => ({
        ...req,
        Avatar: req.Avatar && Buffer.isBuffer(req.Avatar) ? req.Avatar.toString('utf8') : req.Avatar
      }));
    } catch (error) {
      this.logger.error('Failed to get seller requests', error);
      throw error;
    }
  }

  /**
   * Approve seller upgrade request
   */
  async approveSellerRequest(activityId) {
    try {
      const activity = await this.activityRepository.findById(activityId);
      if (!activity || activity.action !== 'REQUEST_SELLER') {
        throw new NotFoundError('Seller request', activityId);
      }

      const userId = activity.user_id;

      await this.userRepository.executeQuery(`
        INSERT IGNORE INTO UserRoles (user_id, role_id) 
        SELECT @uid, id FROM Roles WHERE name = 'SELLER'
      `, { uid: userId });

      await this.activityRepository.delete(activityId);
      this.logger.info(`Seller request ${activityId} approved for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to approve seller request ${activityId}`, error);
      throw error;
    }
  }

  /**
   * Get all products for admin view
   */
  async getAllProductsForAdmin() {
    try {
      const products = await this.productRepository.executeQuery(`
        SELECT p.id as Id, p.name as Name, p.price_starting as Price, p.stock as Stock, u.full_name as SellerName
        FROM Products p LEFT JOIN Users u ON p.seller_id = u.id ORDER BY p.created_at DESC
      `);
      return products;
    } catch (error) {
      this.logger.error('Failed to get all products for admin', error);
      throw error;
    }
  }

  /**
   * Get all auctions for admin view
   */
  async getAllAuctionsForAdmin(searchTerm = '') {
    try {
      let query = ` 
        SELECT
          a.id, a.product_id, a.seller_id, a.starting_price, a.current_price, a.highest_bidder_id,
          a.reserve_price, a.start_date, a.end_date, a.status, a.total_bids, a.min_bid_increment,
          a.is_automatic, a.auto_bid_amount, a.winner_id, a.created_at, a.updated_at, a.ended_at,
          p.name as productName,
          CONCAT('/api/images/product/', p.id, '?index=0') as productImage,
          u.full_name as sellerName, u.avatar as sellerAvatar,
          hb.full_name as highestBidderName, hb.avatar as highestBidderAvatar
        FROM Auctions a
        JOIN Products p ON a.product_id = p.id
        LEFT JOIN Users u ON p.seller_id = u.id
        LEFT JOIN Users hb ON a.highest_bidder_id = hb.id
      `;
      const params = {};
      if (searchTerm) {
        query += ` WHERE p.name LIKE @searchTerm`;
        params.searchTerm = `%${searchTerm}%`;
      }
      query += ` ORDER BY a.created_at DESC`;

      const auctions = await this.auctionRepository.executeQuery(query, params);
      // Ensure Buffer fields are converted for all auctions
      return auctions.map(a => parseBuffer(a));
    } catch (error) {
      this.logger.error('Failed to get all auctions for admin', error);
      throw error;
    }
  }

  /**
   * End auction by admin
   */
  async endAuctionByAdmin(auctionId) {
    try {
      const auction = await this.auctionRepository.findById(auctionId);
      if (!auction) throw new NotFoundError('Auction', auctionId);
      
      // Update end_date to now to trigger processing
      await this.auctionRepository.update(auctionId, { end_date: new Date() });
      await this.auctionService.markAuctionEnded(auctionId);
      this.logger.info(`Admin ended auction ${auctionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to end auction ${auctionId} by admin`, error);
      throw error;
    }
  }

  /**
   * Lấy danh sách yêu cầu rút tiền đang chờ
   */
  async getPendingWithdrawals() {
    try {
      return await this.paymentRepository.executeQuery(`
        SELECT p.id, p.amount, p.momo_order_id as phone, p.created_at, u.full_name as userName, u.email
        FROM Payments p JOIN Users u ON p.user_id = u.id
        WHERE p.type = 'WITHDRAWAL' AND p.status = 'PENDING'
        ORDER BY p.created_at ASC
      `);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xử lý yêu cầu rút tiền thủ công
   */
  async processWithdrawal(paymentId, action) {
    const { getSocket } = require('./SocketManager');
    try {
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment', paymentId);
      }

      if (action === 'APPROVE') {
        await this.paymentRepository.updateStatus(paymentId, 'SUCCESS', { paidAt: new Date() });
        // Gửi thông báo real-time cho người dùng
        getSocket().to(payment.user_id.toString()).emit('walletUpdate', {
          message: 'Yêu cầu rút tiền của bạn đã được chấp thuận và xử lý.',
          isError: false
        });
      } else {
        await this.paymentRepository.updateStatus(paymentId, 'FAILED', { errorMessage: 'Admin từ chối yêu cầu rút tiền' });
        // Gửi thông báo real-time cho người dùng
        getSocket().to(payment.user_id.toString()).emit('walletUpdate', {
          message: 'Yêu cầu rút tiền của bạn đã bị từ chối.',
          isError: true
        });
      }
      return true;
    } catch (error) { throw error; }
  }
}

module.exports = AdminService;