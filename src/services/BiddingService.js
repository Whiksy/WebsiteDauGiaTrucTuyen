const { getLogger } = require('../logger');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { validatePositiveNumber } = require('../utils');
const {
  ValidationError,
  NotFoundError
} = require('../errors');
const { AUCTION_STATUS, VALIDATION, BID_STATUS } = require('../constants/AppConstants');

/**
 * Bidding Service - Handles bid placement and validation
 */
class BiddingService {
  constructor() {
    this.bidRepository = RepositoryFactory.getBidRepository();
    this.auctionRepository = RepositoryFactory.getAuctionRepository();
    this.logger = getLogger('BiddingService');
  }

  /**
   * Place a bid on auction
   */
  async placeBid(auctionId, userId, bidAmount) {
    const connection = await this.auctionRepository.beginTransaction();
    try {
      this.logger.debug(`[placeBid] User ${userId} attempting to bid ${bidAmount} on auction ${auctionId}`);
      // Validate amount
      bidAmount = validatePositiveNumber(bidAmount, 'Bid amount');

      // 1. KIỂM TRA SỐ DƯ VÍ (Áp dụng Dependency Injection qua Factory)
      const { ServiceFactory } = require('./ServiceFactory');
      const walletService = ServiceFactory.getWalletService();
      const stats = await walletService.getBalanceStats(userId);
      if (stats.balance < bidAmount) {
        throw new ValidationError(`Số dư ví không đủ! Bạn cần có tối thiểu ${bidAmount.toLocaleString('vi-VN')} ₫. Vui lòng nạp thêm tiền.`);
      }

      // Get auction with a lock to prevent race conditions
      this.logger.debug(`[placeBid] Locking auction ${auctionId} for update...`);
      const auction = await connection.query('SELECT * FROM Auctions WHERE id = ? FOR UPDATE', [auctionId]).then(res => res[0][0]);
      this.logger.debug(`[placeBid] Auction ${auctionId} locked. Status: ${auction?.status}`);

      if (!auction) {
        throw new NotFoundError('Auction', auctionId);
      }

      // Check auction is still active
      if (auction.status !== AUCTION_STATUS.ACTIVE) {
        throw new ValidationError('Phiên đấu giá này không còn hoạt động.');
      }

      // Check auction has not ended
      if (new Date(auction.end_date) <= new Date()) {
        throw new ValidationError('Phiên đấu giá đã kết thúc.');
      }

      // Ràng buộc: Người bán không được tự đặt giá sản phẩm của mình
      if (auction.seller_id === userId) {
        throw new ValidationError('Bạn không thể đặt giá cho sản phẩm do chính mình đăng bán.');
      }

      // Ràng buộc Logic Đặt Giá Chuyên Nghiệp
      const currentPrice = Number(auction.current_price);
      const startingPrice = Number(auction.starting_price);
      const minBidIncrement = Number(auction.min_bid_increment);

      let minimumBid;
      if (auction.highest_bidder_id === null) {
        // Nếu chưa có ai đặt, được phép đặt ĐÚNG BẰNG giá khởi điểm
        minimumBid = startingPrice;
      } else {
        // Nếu đã có người đặt, bắt buộc phải lớn hơn giá hiện tại + bước giá
        const increment = minBidIncrement > 0 ? minBidIncrement : (currentPrice * 0.05);
        minimumBid = currentPrice + increment;
      }
      
      if (bidAmount < minimumBid) {
        throw new ValidationError(
          `Giá đặt hợp lệ phải từ ${minimumBid.toLocaleString('vi-VN')} ₫ trở lên.`
        );
      }

      // 3. KIỂM TRA GIÁ MUA ĐỨT (RESERVE PRICE / BUY IT NOW)
      let isBuyItNow = false;
      if (auction.reserve_price > 0 && bidAmount >= auction.reserve_price) {
        isBuyItNow = true;
        bidAmount = Number(auction.reserve_price); // Giới hạn số tiền bị trừ đúng bằng giá mua đứt
      }

      // Check user is not the current highest bidder (can add more but should prevent multiple consecutive bids)
      if (auction.highest_bidder_id === userId) {
        throw new ValidationError('Bạn đang là người giữ giá cao nhất.');
      }

      // Create bid record directly on the transaction connection to avoid deadlock
      this.logger.debug(`[placeBid] Creating bid record for auction ${auctionId}...`);
      const [bidResult] = await connection.execute(
        'INSERT INTO Bids (auction_id, bidder_id, amount, bid_time) VALUES (?, ?, ?, ?)',
        [auctionId, userId, bidAmount, new Date()]
      );
      const bidId = bidResult.insertId;
      this.logger.debug(`[placeBid] Bid record ${bidId} created.`);

      // Update auction with new highest bid directly on the transaction connection
      this.logger.debug(`[placeBid] Updating auction ${auctionId} with new price...`);
      
      const newEndDateQuery = isBuyItNow ? ', end_date = NOW()' : ''; // Nếu mua đứt, ép thời gian kết thúc về hiện tại
      await connection.execute(
        `UPDATE Auctions SET current_price = ?, highest_bidder_id = ?, updated_at = ? ${newEndDateQuery} WHERE id = ?`,
        [bidAmount, userId, new Date(), auctionId]
      );
      this.logger.debug(`[placeBid] Auction ${auctionId} updated.`);

      await this.auctionRepository.commit(connection);
      this.logger.info(`Bid ${bidId} placed by user ${userId} on auction ${auctionId}: ${bidAmount}. Transaction committed.`);

      // THÊM REALTIME: Phát sự kiện bidUpdate đến tất cả client để cập nhật giao diện ngay lập tức
      try {
        const { getSocket } = require('./SocketManager');
        const io = getSocket();
        
        // Lấy tên người dùng để hiển thị đẹp hơn
        const userResult = await this.auctionRepository.executeQuery('SELECT full_name FROM Users WHERE id = ?', [userId]);
        const bidderName = userResult[0]?.full_name || 'Người dùng ẩn';

        io.emit('bidUpdate', { 
            auctionId, 
            bidAmount, 
            userId,
            bidderName
        });
      } catch (socketErr) {
        this.logger.error('Failed to emit bidUpdate socket event', socketErr);
      }

      // 4. KẾT THÚC NGAY LẬP TỨC NẾU MUA ĐỨT
      if (isBuyItNow) {
         const auctionService = ServiceFactory.getAuctionService();
         auctionService.markAuctionEnded(auctionId).catch(err => this.logger.error('Error auto-ending auction', err));
      }

      return {
        bidId,
        auctionId,
        bidderId: userId,
        amount: bidAmount,
        timestamp: new Date()
      };
    } catch (error) {
      await this.auctionRepository.rollback(connection);
      this.logger.error(`Failed to place bid on auction ${auctionId}. Transaction rolled back.`, error);
      throw error;
    }
  }

  /**
   * Get bid history for auction
   */
  async getAuctionBidHistory(auctionId, limit = 50, offset = 0) {
    try {
      return await this.bidRepository.getAuctionBids(auctionId, limit, offset);
    } catch (error) {
      this.logger.error(`Failed to get bid history for auction ${auctionId}`, error);
      throw error;
    }
  }

  /**
   * Get user bids
   */
  async getUserBids(userId, limit = 50, offset = 0) {
    try {
      return await this.bidRepository.getUserBids(userId, limit, offset);
    } catch (error) {
      this.logger.error(`Failed to get bids for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get bid history for a specific auction (for admin/seller view)
   */
  async getAuctionBidHistoryDetails(auctionId, limit = 50, offset = 0) {
    try {
      const bids = await this.bidRepository.getAuctionBidsWithUserDetails(auctionId, limit, offset);
      return bids.map(b => ({
        ...b,
        bidderAvatar: b.bidderAvatar && Buffer.isBuffer(b.bidderAvatar) ? b.bidderAvatar.toString('utf8') : b.bidderAvatar
      }));
    } catch (error) {
      this.logger.error(`Failed to get bid history details for auction ${auctionId}`, error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử đấu giá cho một người dùng cụ thể
   */
  async getBidHistoryForUser(userId, limit = 50) {
    try {
      return await this.bidRepository.findHistoryByUserId(userId, limit);
    } catch (error) {
      this.logger.error(`Failed to get bid history for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get highest bid for auction
   */
  async getHighestBid(auctionId) {
    try {
      return await this.bidRepository.getHighestBid(auctionId);
    } catch (error) {
      this.logger.error(`Failed to get highest bid for auction ${auctionId}`, error);
      throw error;
    }
  }

  /**
   * Get bid count for auction
   */
  async getBidCount(auctionId) {
    try {
      return await this.bidRepository.bidCount(auctionId);
    } catch (error) {
      this.logger.error(`Failed to get bid count for auction ${auctionId}`, error);
      throw error;
    }
  }

  /**
   * Check if user has bid on auction
   */
  async hasUserBid(auctionId, userId) {
    try {
      return await this.bidRepository.hasBid(auctionId, userId);
    } catch (error) {
      this.logger.error(`Failed to check if user ${userId} bid on auction ${auctionId}`, error);
      throw error;
    }
  }
}

module.exports = BiddingService;
