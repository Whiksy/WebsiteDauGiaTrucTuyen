const BaseRepository = require('./BaseRepository');

/**
 * Payment Repository - Handles payment-related database operations
 */
class PaymentRepository extends BaseRepository {
  constructor() {
    super('Payments');
  }

  /**
   * Find payment by transaction ID
   */
  async findByTransactionId(transactionId) {
    const query = `SELECT * FROM Payments WHERE transaction_id = @transactionId`;
    const request = this.db.createRequest();
    request.input('transactionId', transactionId);
    
    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  /**
   * Get user payments
   */
  async getUserPayments(userId, limit = 50, offset = 0) {
    const query = `
      SELECT * FROM Payments
      WHERE user_id = @userId
      ORDER BY created_at DESC
      LIMIT @limit OFFSET @offset
    `;
    const request = this.db.createRequest();
    request.input('userId', userId);
    request.input('offset', offset);
    request.input('limit', limit);
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Get auction payments
   */
  async getAuctionPayments(auctionId) {
    const query = `SELECT * FROM Payments WHERE auction_id = @auctionId`;
    const request = this.db.createRequest();
    request.input('auctionId', auctionId);
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Update payment status by payment ID
   */
  async updateStatus(paymentId, status, metadata = null) {
    const query = `
      UPDATE Payments 
      SET status = @status, updated_at = NOW(), momo_order_id = @momoOrderId, error_message = @errorMessage, paid_at = @paidAt
      WHERE id = @id
    `;
    const request = this.db.createRequest();
    request.input('id', paymentId);
    request.input('status', status);
    request.input('momoOrderId', metadata?.momoOrderId || null);
    request.input('errorMessage', metadata?.errorMessage || null);
    request.input('paidAt', metadata?.paidAt || null);
    const result = await request.query(query);
    return result.rowsAffected[0];
  }

  /**
   * Update payment by transaction ID (for IPN)
   */
  async updateByTransactionId(transactionId, data) {
    const setClause = Object.keys(data).map(key => `${key} = @${key}`).join(', ');
    const query = `UPDATE Payments SET ${setClause}, updated_at = NOW() WHERE transaction_id = @transactionId`;
    const request = this.db.createRequest();
    request.input('transactionId', transactionId);
    Object.entries(data).forEach(([key, value]) => request.input(key, value));
    const result = await request.query(query);
    return result.rowsAffected[0];
  }
}

module.exports = PaymentRepository;
