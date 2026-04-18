const { getLogger } = require('../logger');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { getSocket } = require('./SocketManager');

const {
  validatePositiveNumber,
  validateFutureDate,

} = require('../utils/validator');
const { parseBuffer } = require('../utils/formatter');
const {
  ValidationError,
  NotFoundError
} = require('../errors');
const { AUCTION_STATUS } = require('../constants/AppConstants');

// Khởi tạo Redis Client độc lập cho Caching
const redis = require('redis');
let redisClient = null;
try {
  redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' });
  redisClient.connect().then(() => console.log('✅ Redis connected for Auction Caching')).catch(() => console.warn('⚠️ Redis not available'));
} catch(e) {
  console.warn('Redis init failed');
}

/**
 * Auction Service - Handles auction operations
 */
class AuctionService {
  constructor() {
    this.auctionRepository = RepositoryFactory.getAuctionRepository();
    this.productRepository = RepositoryFactory.getProductRepository();
    this.bidRepository = RepositoryFactory.getBidRepository();
    this.userRepository = RepositoryFactory.getUserRepository();
    this.logger = getLogger('AuctionService');
  }

  /**
   * Create auction
   */
  async createAuction(sellerId, auctionData) {
    try {
      // Verify product exists and belongs to seller
      const product = await this.productRepository.findById(auctionData.productId);
      if (!product) {
        throw new NotFoundError('Product', auctionData.productId);
      }
      if (product.seller_id !== sellerId) {
        throw new ValidationError('Không được phép: Cannot create auction for this product');
      }

      // Validate auction data
      const startingBid = validatePositiveNumber(auctionData.startingBid, 'Starting bid');
      const endTime = validateFutureDate(auctionData.endTime);

      // Ràng buộc 1: Thời gian kết thúc phải cách hiện tại ít nhất 1 giờ
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      if (endTime < oneHourFromNow) {
        throw new ValidationError('Thời gian kết thúc phải cách hiện tại ít nhất 1 giờ.');
      }

      // Ràng buộc 2: Giá mua đứt / Giá dự trữ (Reserve Price)
      let reservePrice = null;
      if (auctionData.reservePrice) {
        reservePrice = validatePositiveNumber(auctionData.reservePrice, 'Reserve price');
        if (reservePrice <= startingBid) {
          throw new ValidationError('Giá mua đứt (Reserve Price) phải lớn hơn giá khởi điểm.');
        }
      }

      // Ràng buộc 3: Bước giá tối thiểu (Min Bid Increment)
      let minBidIncrement = null;
      if (auctionData.minBidIncrement) {
        minBidIncrement = validatePositiveNumber(auctionData.minBidIncrement, 'Min bid increment');
      } else {
        minBidIncrement = startingBid * 0.05; // Mặc định bước giá = 5% giá khởi điểm
      }

      // Create auction
      const auctionId = await this.auctionRepository.create({
        product_id: auctionData.productId,
        seller_id: sellerId,
        starting_price: startingBid,
        current_price: startingBid,
        reserve_price: reservePrice,
        min_bid_increment: minBidIncrement,
        start_date: new Date(),
        end_date: endTime,
        status: AUCTION_STATUS.ACTIVE,
        created_at: new Date(),
        updated_at: new Date()
      });

      this.logger.info(`Auction ${auctionId} created by seller ${sellerId}`);
      
      // Phát sự kiện realtime có phiên đấu giá mới (tuỳ chọn cho Frontend cập nhật UI)
      try {
        const io = getSocket();
        io.emit('newAuction', { auctionId, productName: product.name });
      } catch (e) { this.logger.error('Socket emit error', e); }

      return auctionId;
    } catch (error) {
      this.logger.error('Failed to create auction', error);
      throw error;
    }
  }

  /**
   * Get auction details
   */
  async getAuction(auctionId) {
    try {
      const auction = await this.auctionRepository.findWithDetails(auctionId);
      if (!auction) {
        throw new NotFoundError('Auction', auctionId);
      }

      // Lấy danh sách ảnh từ ProductRepository
      const images = await this.productRepository.getImages(auction.product_id);
      auction.images = images.map((img, index) => `/api/images/product/${auction.product_id}?index=${index}`);

      // Add bid count and formatted prices
      auction.bidCount = await this.bidRepository.bidCount(auctionId);
      auction.isEnded = new Date(auction.end_date) <= new Date();

      return parseBuffer(auction); // Ensure all relevant fields are processed
    } catch (error) {
      this.logger.error(`Failed to get auction ${auctionId}`, error);
      throw error;
    }
  }

  /**
   * Get active auctions
   */
  async getActiveAuctions(limit = 50, offset = 0) {
    try {
      const auctions = await this.auctionRepository.findActive(limit, offset);
      return auctions.map(a => {
        // Explicitly convert image buffers for each auction object
        return parseBuffer(a);
      });
    } catch (error) {
      this.logger.error('Failed to get active auctions', error);
      throw error;
    }
  }

  /**
   * Get ended auctions
   */
  async getEndedAuctions(limit = 50, offset = 0) {
    try {
      const auctions = await this.auctionRepository.findEnded(limit, offset);
      return auctions.map(a => {
        // Explicitly convert image buffers for each auction object
        return parseBuffer(a);
      });
    } catch (error) {
      this.logger.error('Failed to get ended auctions', error);
      throw error;
    }
  }

  /**
   * Get seller auctions
   */
  async getSellerAuctions(sellerId, limit = 50, offset = 0, searchTerm = '') {
    try {
      const auctions = await this.auctionRepository.findBySeller(sellerId, limit, offset, searchTerm);
      const total = await this.auctionRepository.countBySeller(sellerId, searchTerm);
      return { auctions: auctions.map(a => parseBuffer(a)), total };
    } catch (error) {
      this.logger.error(`Failed to get auctions for seller ${sellerId}`, error);
      throw error;
    }
  }

  /**
   * Search auctions
   */
  async searchAuctions(term, filters = {}, limit = 50, offset = 0) {
    try {
      let cacheKey = null;
      
      // Nếu Redis đang chạy, tiến hành kiểm tra Cache
      if (redisClient && redisClient.isReady) {
        cacheKey = `auctions:search:${term || 'none'}:${JSON.stringify(filters)}:${limit}:${offset}`;
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          return JSON.parse(cachedData); // Trả về ngay lập tức, MySQL không cần chạy!
        }
      }

      // Nếu không có cache, gọi MySQL
      const auctions = await this.auctionRepository.search(term, filters, limit, offset);
      const result = auctions.map(a => {
        // Explicitly convert image buffers for each auction object
        return parseBuffer(a);
      });

      // Lưu lại vào Redis với thời gian sống (TTL) là 15 giây
      if (cacheKey) {
         await redisClient.setEx(cacheKey, 15, JSON.stringify(result));
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to search auctions', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách các mặt hàng đã bán thành công của người bán
   */
  async getSoldItemsBySeller(sellerId, limit = 50, offset = 0, searchTerm = '') {
    try {
      const soldItems = await this.auctionRepository.findSoldItemsBySeller(sellerId, limit, offset, searchTerm);
      const total = await this.auctionRepository.countSoldItemsBySeller(sellerId, searchTerm);
      const formattedItems = soldItems.map(a => ({ ...a, buyerAvatar: a.buyerAvatar && Buffer.isBuffer(a.buyerAvatar) ? a.buyerAvatar.toString('utf8') : a.buyerAvatar }));
      return { soldItems: formattedItems, total };
    } catch (error) {
      this.logger.error(`Failed to get sold items for seller ${sellerId}`, error);
      throw error;
    }
  }

  /**
   * Đăng lại phiên đấu giá
   */
  async relistAuction(auctionId, sellerId, newEndTime) {
    try {
      await this.auctionRepository.relist(auctionId, sellerId, newEndTime);
      this.logger.info(`Auction ${auctionId} relisted by seller ${sellerId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to relist auction ${auctionId}`, error);
      throw error;
    }
  }

  /**
   * Lấy các phiên đấu giá người dùng đang tham gia
   */
  async getParticipatingAuctions(userId) {
    try {
      const auctions = await this.auctionRepository.findParticipatingByUserId(userId);
      return auctions.map(a => ({
        ...a
      }));
    } catch (error) {
      this.logger.error(`Failed to get participating auctions for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Lấy các phiên đấu giá người dùng đã thắng
   */
  async getWonAuctions(userId) {
    try {
      const wonItems = await this.auctionRepository.findWonByUserId(userId);
      return wonItems.map(a => ({
        ...a
      }));
    } catch (error) {
      this.logger.error(`Failed to get won auctions for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Kết thúc sớm phiên đấu giá (Dành cho Seller)
   */
  async endAuctionEarly(auctionId, sellerId) {
    try {
      const auction = await this.auctionRepository.findWithDetails(auctionId);
      if (!auction) {
        throw new NotFoundError('Auction', auctionId);
      }

      if (auction.seller_id !== sellerId) {
        throw new ValidationError('Không được phép: Không thể kết thúc phiên đấu giá này');
      }

      if (auction.status !== AUCTION_STATUS.ACTIVE) {
        throw new ValidationError('Chỉ có thể kết thúc phiên đấu giá đang hoạt động');
      }

      // Cập nhật ngày kết thúc thành hiện tại để ngắt phiên
      await this.auctionRepository.update(auctionId, { end_date: new Date() });
      await this.markAuctionEnded(auctionId);

      this.logger.info(`Auction ${auctionId} ended early by seller ${sellerId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to end auction early ${auctionId}`, error);
      throw error;
    }
  }

  /**
   * Cancel auction (only seller can, and only if no bids)
   */
  async cancelAuction(auctionId, sellerId) {
    try {
      const auction = await this.auctionRepository.findWithDetails(auctionId);
      if (!auction) {
        throw new NotFoundError('Auction', auctionId);
      }

      if (auction.seller_id !== sellerId) {
        throw new ValidationError('Không được phép: Cannot cancel this auction');
      }

      // Check if there are any bids
      const bidCount = await this.bidRepository.bidCount(auctionId);
      if (bidCount > 0) {
        throw new ValidationError('Cannot cancel auction with existing bids');
      }

      // Update status
      await this.auctionRepository.updateStatus(auctionId, AUCTION_STATUS.CANCELLED);

      this.logger.info(`Auction ${auctionId} cancelled by seller ${sellerId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel auction ${auctionId}`, error);
      throw error;
    }
  }

  /**
   * Get auctions that need processing (ended but not yet marked as ended)
   */
  async getAuctionsToProcess() {
    try {
      return await this.auctionRepository.findJustEnded();
    } catch (error) {
      this.logger.error('Failed to get auctions to process', error);
      throw error;
    }
  }

  /**
   * Mark auction as ended (called by scheduler)
   */
  async markAuctionEnded(auctionId) {
    try {
      const highestBid = await this.bidRepository.getHighestBid(auctionId);
      const highestBidderId = highestBid ? highestBid.bidder_id : null;
      const currentPrice = highestBid ? highestBid.amount : 0;

      await this.auctionRepository.updateStatus(
        auctionId,
        AUCTION_STATUS.ENDED,
        highestBidderId
      );

      this.logger.info(`Auction ${auctionId} marked as ended, winner: ${highestBidderId || 'none'}`);

      // Phát sự kiện realtime để tất cả client khóa nút đặt giá ngay lập tức
      try {
          const io = getSocket();
          io.emit('auctionEnded', { auctionId, winnerId: highestBidderId, finalPrice: currentPrice });
      } catch (e) {}

      // Tự động thanh toán trừ ví người thắng
      if (highestBidderId && currentPrice > 0) {
          const { ServiceFactory } = require('./ServiceFactory');
          const walletService = ServiceFactory.getWalletService();
          const paymentSuccess = await walletService.payForWonAuction(auctionId, highestBidderId, currentPrice);
          
          // Bắn sự kiện real-time cho người thắng và người bán
          if (paymentSuccess) {
              this.logger.info(`[Auto-Payment] Success for auction ${auctionId}, user ${highestBidderId}. Emitting socket events.`);
              try {
                  const io = getSocket();
                  const auctionDetails = await this.auctionRepository.findWithDetails(auctionId);
                  
                  // Bắt đầu luồng Gửi Email Thông Báo Mua Hàng
                  const emailService = ServiceFactory.getEmailService();
                  const buyerInfo = await this.userRepository.findById(highestBidderId);
                  
                  if (buyerInfo && buyerInfo.email && auctionDetails) {
                      // Gửi email bất đồng bộ, không dùng await cản trở luồng kết thúc đấu giá
                      emailService.sendAuctionWinEmail(buyerInfo.email, buyerInfo.full_name || 'Khách hàng', auctionDetails.productName, currentPrice, auctionId);
                  }

                  if (auctionDetails) {
                      // Gửi cho người thắng
                      io.to(highestBidderId.toString()).emit('auctionWin', { 
                          message: `Chúc mừng! Bạn đã thắng đấu giá "${auctionDetails.productName}".`, 
                          auctionId 
                      });
                      // Gửi cho người bán
                      io.to(auctionDetails.seller_id.toString()).emit('productSold', { 
                          message: `Sản phẩm "${auctionDetails.productName}" đã được bán.`, 
                          auctionId 
                      });
                  }
              } catch (socketError) {
                  this.logger.error(`[SocketEmit] Failed to emit events for ended auction ${auctionId}`, socketError);
              }
          } else {
              this.logger.warn(`[Auto-Payment] Failed (Insufficient balance) for auction ${auctionId}, user ${highestBidderId}`);
              // Gửi sự kiện thanh toán thất bại cho người thắng
              const io = getSocket();
              io.to(highestBidderId.toString()).emit('paymentFail', { message: 'Thanh toán đấu giá thất bại do không đủ số dư.', auctionId });
          }
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to mark auction ${auctionId} as ended`, error);
      throw error;
    }
  }
}

module.exports = AuctionService;
