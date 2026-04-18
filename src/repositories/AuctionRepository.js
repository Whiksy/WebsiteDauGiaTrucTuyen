const BaseRepository = require('./BaseRepository');
const { QueryBuilder } = require('../utils');

/**
 * Auction Repository - Handles all auction-related database operations
 */
class AuctionRepository extends BaseRepository {
  constructor() {
    super('Auctions');
  }

  /**
   * Find auction with full details
   */
  async findWithDetails(auctionId) {
    const query = `
      SELECT 
        a.*,
        p.name as productName,
        p.description as productDescription,
        p.seller_id as productSellerId,
        u.full_name as sellerName,
        u.avatar as sellerAvatar,
        hb.full_name as highestBidderName,
        hb.avatar as highestBidderAvatar, 
        CONCAT('/api/images/product/', p.id, '?index=0') as productImage,
        (SELECT COUNT(*) FROM Bids WHERE auction_id = a.id) as bidCount
      FROM Auctions a
      JOIN Products p ON a.product_id = p.id
      LEFT JOIN Users u ON p.seller_id = u.id
      LEFT JOIN Users hb ON a.highest_bidder_id = hb.id
      WHERE a.id = @id
    `;
    const request = this.db.createRequest();
    request.input('id', auctionId);
    
    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  /**
   * Find active auctions with details
   */
  async findActive(limit = 50, offset = 0) {
    const query = `
      SELECT 
        a.*,
        p.name as productName,
        p.seller_id as productSellerId,
        u.full_name as sellerName,
        u.avatar as sellerAvatar,
        hb.full_name as highestBidderName,
        hb.avatar as highestBidderAvatar,
        CONCAT('/api/images/product/', p.id, '?index=0') as productImage,
        (SELECT COUNT(*) FROM Bids WHERE auction_id = a.id) as bidCount
      FROM Auctions a
      JOIN Products p ON a.product_id = p.id
      LEFT JOIN Users u ON p.seller_id = u.id
      LEFT JOIN Users hb ON a.highest_bidder_id = hb.id
      WHERE a.status = 'ACTIVE' AND a.end_date > NOW()
      ORDER BY a.created_at DESC
      LIMIT @offset, @limit
    `;
    const request = this.db.createRequest();
    request.input('offset', offset);
    request.input('limit', limit);
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Find ended auctions
   */
  async findEnded(limit = 50, offset = 0) {
    const query = `
      SELECT 
        a.*,
        p.name as productName,
        u.full_name as sellerName,
        u.avatar as sellerAvatar,
        hb.full_name as highestBidderName,
        hb.avatar as highestBidderAvatar,
        CONCAT('/api/images/product/', p.id, '?index=0') as productImage,
        (SELECT COUNT(*) FROM Bids WHERE auction_id = a.id) as bidCount
      FROM Auctions a
      JOIN Products p ON a.product_id = p.id
      WHERE a.status IN ('ENDED', 'PROCESSING') AND a.end_date <= NOW()
      ORDER BY a.end_date DESC
      LIMIT @offset, @limit
    `;
    const request = this.db.createRequest();
    request.input('offset', offset);
    request.input('limit', limit);
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Tìm các mặt hàng đã bán của người bán
   */
  async findSoldItemsBySeller(sellerId, limit = 50, offset = 0, searchTerm = '') {
    let query = `
      SELECT a.id, p.name as productName, a.current_price as soldPrice, 
             u.full_name as buyerName, u.email as buyerEmail, u.avatar as buyerAvatar,
             CONCAT('/api/images/product/', p.id, '?index=0') as image,
             COALESCE((SELECT status FROM Payments WHERE auction_id = a.id AND user_id = COALESCE(a.winner_id, a.highest_bidder_id) ORDER BY created_at DESC LIMIT 1), 'PENDING') as paymentStatus,
             EXISTS(SELECT 1 FROM Activities WHERE action = 'ITEM_DELIVERED' AND target_id = a.id) as isDelivered
      FROM Auctions a
      JOIN Products p ON a.product_id = p.id
      LEFT JOIN Users u ON COALESCE(a.winner_id, a.highest_bidder_id) = u.id
      WHERE a.seller_id = @sellerId AND a.status IN ('ENDED', 'PROCESSING')
    `;
    const params = { sellerId, limit, offset };
    if (searchTerm) {
      query += ` AND (p.name LIKE @searchTerm OR u.full_name LIKE @searchTerm)`;
      params.searchTerm = `%${searchTerm}%`;
    }
    query += ` ORDER BY a.end_date DESC LIMIT @offset, @limit`;

    const request = this.db.createRequest();
    Object.entries(params).forEach(([key, value]) => request.input(key, value));
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Đếm các mặt hàng đã bán của người bán
   */
  async countSoldItemsBySeller(sellerId, searchTerm = '') {
    let query = `
      SELECT COUNT(a.id) as total
      FROM Auctions a
      JOIN Products p ON a.product_id = p.id
      LEFT JOIN Users u ON COALESCE(a.winner_id, a.highest_bidder_id) = u.id
      WHERE a.seller_id = @sellerId AND a.status IN ('ENDED', 'PROCESSING')
    `;
    const params = { sellerId };
    if (searchTerm) {
      query += ` AND (p.name LIKE @searchTerm OR u.full_name LIKE @searchTerm)`;
      params.searchTerm = `%${searchTerm}%`;
    }
    const request = this.db.createRequest();
    Object.entries(params).forEach(([key, value]) => request.input(key, value));
    const result = await request.query(query);
    return result.recordset[0]?.total || 0;
  }

  /**
   * Đăng lại phiên đấu giá
   */
  async relist(auctionId, sellerId, newEndTime) {
    const query = `
      UPDATE Auctions 
      SET status = 'ACTIVE', end_date = @newEndTime, current_price = starting_price, 
          total_bids = 0, highest_bidder_id = NULL, winner_id = NULL, updated_at = NOW() 
      WHERE id = @auctionId AND seller_id = @sellerId
    `;
    const request = this.db.createRequest();
    request.input('auctionId', auctionId);
    request.input('sellerId', sellerId);
    request.input('newEndTime', newEndTime);
    const result = await request.query(query);
    return result.rowsAffected[0];
  }

  /**
   * Tìm các phiên đấu giá người dùng đang tham gia
   */
  async findParticipatingByUserId(userId) {
    const query = `
      SELECT DISTINCT a.id, a.current_price as currentBid, a.end_date as endTime, p.name as productName,
      CONCAT('/api/images/product/', p.id, '?index=0') as image,
      IF(a.highest_bidder_id = @userId, true, false) as isWinning,
      u.full_name as topBidder
      FROM Bids b
      JOIN Auctions a ON b.auction_id = a.id
      JOIN Products p ON a.product_id = p.id
      LEFT JOIN Users u ON a.highest_bidder_id = u.id
      WHERE b.bidder_id = @userId AND a.status = 'ACTIVE'
    `;
    const request = this.db.createRequest();
    request.input('userId', userId);
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Tìm các phiên đấu giá người dùng đã thắng
   */
  async findWonByUserId(userId) {
    const query = `
      SELECT a.id, p.name as productName, a.current_price as winningPrice, u.full_name as sellerName,
      (SELECT status FROM Payments WHERE auction_id = a.id AND user_id = @userId ORDER BY created_at DESC LIMIT 1) as paymentStatus,
      CONCAT('/api/images/product/', p.id, '?index=0') as image
      FROM Auctions a
      JOIN Products p ON a.product_id = p.id
      JOIN Users u ON a.seller_id = u.id
      WHERE (a.winner_id = @userId OR a.highest_bidder_id = @userId) AND a.status IN ('ENDED', 'PROCESSING')
    `;
    const request = this.db.createRequest();
    request.input('userId', userId);
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Find auctions by seller
   */
  async findBySeller(sellerId, limit = 50, offset = 0, searchTerm = '') {
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
      WHERE p.seller_id = @sellerId
    `;
    const params = { sellerId, limit, offset };
    if (searchTerm) {
      query += ` AND p.name LIKE @searchTerm`;
      params.searchTerm = `%${searchTerm}%`;
    }
    query += ` ORDER BY a.created_at DESC LIMIT @offset, @limit`;

    const request = this.db.createRequest();
    Object.entries(params).forEach(([key, value]) => request.input(key, value));
    
    const result = await request.query(query);
    return result.recordset;
  }

  async countBySeller(sellerId, searchTerm = '') {
    let query = `SELECT COUNT(a.id) as total FROM Auctions a JOIN Products p ON a.product_id = p.id WHERE p.seller_id = @sellerId`;
    const params = { sellerId };
    if (searchTerm) {
      query += ` AND p.name LIKE @searchTerm`;
      params.searchTerm = `%${searchTerm}%`;
    }
    const request = this.db.createRequest();
    Object.entries(params).forEach(([key, value]) => request.input(key, value));
    const result = await request.query(query);
    return result.recordset[0]?.total || 0;
  }

  /**
   * Find auctions that just ended (for cron job)
   */
  async findJustEnded() {
    const query = `
      SELECT a.id, a.current_price, a.highest_bidder_id, p.seller_id
      FROM Auctions a
      JOIN Products p ON a.product_id = p.id 
      WHERE a.end_date <= NOW() AND a.status = 'ACTIVE'
    `;
    const request = this.db.createRequest();
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Update auction status and winner
   */
  async updateStatus(auctionId, status, highestBidderId = null) {
    let query = `
      UPDATE Auctions 
      SET status = @status, updated_at = NOW()
    `;
    if (status === 'ENDED') {
      if (highestBidderId) {
        query += `, winner_id = @highestBidderId, ended_at = NOW()`;
      } else {
        query += `, winner_id = highest_bidder_id, ended_at = NOW()`;
      }
    }
    query += ` WHERE id = @id`;

    const request = this.db.createRequest();
    request.input('id', auctionId);
    request.input('status', status);
    if (highestBidderId) request.input('highestBidderId', highestBidderId);
    const result = await request.query(query);
    return result.rowsAffected[0];
  }

  /**
   * Search auctions
   */
  async search(term, filters = {}, limit = 50, offset = 0) {
    const request = this.db.createRequest();
    const qb = new QueryBuilder('Auctions a')
      .select(`
        a.id, a.current_price as currentBid, a.starting_price as startingPrice, 
        a.reserve_price as reservePrice,
        a.end_date as endTime, a.status, 
        p.name as productName, p.seller_id as productSellerId,
        u.full_name as highestBidderName,
        CONCAT('/api/images/product/', p.id, '?index=0') as productImage
      `)
      .join('JOIN Products p ON a.product_id = p.id')
      .join('LEFT JOIN Users u ON a.highest_bidder_id = u.id')
      .whereLike(['p.name', 'p.description'], term)
      .whereGreaterThanOrEqual('a.current_price', filters.minPrice, 'minPrice')
      .whereLessThanOrEqual('a.current_price', filters.maxPrice, 'maxPrice')
      .whereEquals('a.status', filters.status, 'status')
      .whereEquals('p.category_id', filters.categoryId, 'categoryId')
      .orderBy('a.created_at', 'DESC')
      .paginate(limit, offset);

    const query = qb.build(request);
    const result = await request.query(query);
    return result.recordset;
  }
}

module.exports = AuctionRepository;
