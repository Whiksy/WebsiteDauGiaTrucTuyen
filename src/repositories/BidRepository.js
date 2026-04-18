const BaseRepository = require('./BaseRepository');

/**
 * Bid Repository - Handles all bid-related database operations
 */
class BidRepository extends BaseRepository {
  constructor() {
    super('Bids');
  }

  /**
   * Find bid with bidder details
   */
  async findWithBidder(bidId) {
    const query = `
      SELECT b.*, u.full_name as bidderName, u.avatar as bidderAvatar
      FROM Bids b
      LEFT JOIN Users u ON b.bidder_id = u.id
      WHERE b.id = @id
    `;
    const request = this.db.createRequest();
    request.input('id', bidId);
    
    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  /**
   * Get highest bid for auction
   */
  async getHighestBid(auctionId) {
    const query = `
      SELECT * FROM Bids WHERE auction_id = @auctionId
      ORDER BY amount DESC, bid_time DESC
      LIMIT 1
    `;
    const request = this.db.createRequest();
    request.input('auctionId', auctionId);
    
    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  /**
   * Get auction bids history
   */
  async getAuctionBids(auctionId, limit = 50, offset = 0) {
    const query = `
      SELECT b.*, u.full_name as bidderName, u.avatar as bidderAvatar
      FROM Bids b
      LEFT JOIN Users u ON b.bidder_id = u.id
      WHERE b.auction_id = @auctionId
      ORDER BY b.amount DESC, b.bid_time DESC
      LIMIT @offset, @limit
    `;
    const request = this.db.createRequest();
    request.input('auctionId', auctionId);
    request.input('offset', offset);
    request.input('limit', limit);
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Get auction bids history with user details
   */
  async getAuctionBidsWithUserDetails(auctionId, limit = 50, offset = 0) {
    const query = `
      SELECT b.id, b.amount, b.bid_time, u.full_name as bidderName, u.avatar as bidderAvatar
      FROM Bids b
      JOIN Users u ON b.bidder_id = u.id
      WHERE b.auction_id = @auctionId
      ORDER BY b.amount DESC, b.bid_time DESC
      LIMIT @offset, @limit
    `;
    const request = this.db.createRequest();
    request.input('auctionId', auctionId);
    request.input('offset', offset);
    request.input('limit', limit);
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Get user bids
   */
  async getUserBids(userId, limit = 50, offset = 0) {
    const query = `
      SELECT b.*, p.name as productName
      FROM Bids b
      JOIN Auctions a ON b.auction_id = a.id
      JOIN Products p ON a.product_id = p.id
      WHERE b.bidder_id = @userId
      ORDER BY b.bid_time DESC
      LIMIT @offset, @limit
    `;
    const request = this.db.createRequest();
    request.input('userId', userId);
    request.input('offset', offset);
    request.input('limit', limit);
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Check if user already bid on auction
   */
  async hasBid(auctionId, userId) {
    const query = `
      SELECT COUNT(*) as count FROM Bids 
      WHERE auction_id = @auctionId AND bidder_id = @userId
    `;
    const request = this.db.createRequest();
    request.input('auctionId', auctionId);
    request.input('userId', userId);
    
    const result = await request.query(query);
    return result.recordset[0].count > 0;
  }

  /**
   * Bid count for auction
   */
  async bidCount(auctionId) {
    const query = `SELECT COUNT(*) as count FROM Bids WHERE auction_id = @auctionId`;
    const request = this.db.createRequest();
    request.input('auctionId', auctionId);
    
    const result = await request.query(query);
    return result.recordset[0].count;
  }
  /**
   * Lấy lịch sử đấu giá của người dùng với trạng thái thắng/thua
   */
  async findHistoryByUserId(userId, limit = 50) {
    const query = `
      SELECT b.id, p.name as productName, b.amount, a.current_price as currentBid, b.bid_time as timestamp,
      IF(a.status = 'ENDED' AND (a.winner_id = b.bidder_id OR a.highest_bidder_id = b.bidder_id), 'WON', 
        IF(a.status = 'ENDED', 'LOST', 'ACTIVE')) as status
      FROM Bids b
      JOIN Auctions a ON b.auction_id = a.id
      JOIN Products p ON a.product_id = p.id
      WHERE b.bidder_id = @userId
      ORDER BY b.bid_time DESC
      LIMIT @limit
    `;
    const request = this.db.createRequest();
    request.input('userId', userId);
    request.input('limit', limit);
    const result = await request.query(query);
    return result.recordset;
  }
}

module.exports = BidRepository;
