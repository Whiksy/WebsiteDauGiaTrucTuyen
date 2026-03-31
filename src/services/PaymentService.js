const { getLogger } = require('../logger');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { validatePositiveNumber, generateHMAC } = require('../utils');
const { NotFoundError } = require('../errors');
const { PAYMENT_STATUS } = require('../constants/AppConstants');
const { getConfig } = require('../config');
const crypto = require('crypto');

/**
 * Payment Service - Handles payment processing
 */
class PaymentService {
  constructor() {
    this.paymentRepository = RepositoryFactory.getPaymentRepository();
    this.auctionRepository = RepositoryFactory.getAuctionRepository();
    this._walletService = null; // Lazy load để ngăn phụ thuộc vòng tròn
    this.logger = getLogger('PaymentService');
    this.config = getConfig();
  }

  // Tải trễ WalletService để phá vỡ phụ thuộc vòng tròn
  get walletService() {
    if (!this._walletService) {
      const { ServiceFactory } = require('./ServiceFactory');
      this._walletService = ServiceFactory.getWalletService();
    }
    return this._walletService;
  }
  /**
   * Create payment record
   */
  async createPayment(userId, auctionId, amount, method = 'Momo') {
    try {
      amount = validatePositiveNumber(amount, 'Payment amount');

      const auction = await this.auctionRepository.findById(auctionId);
      if (!auction) {
        throw new NotFoundError('Auction', auctionId);
      }

      const transactionId = this._generateTransactionId();

      const paymentId = await this.paymentRepository.create({
        UserId: userId,
        AuctionId: auctionId,
        Amount: amount,
        Method: method,
        TransactionId: transactionId,
        Status: PAYMENT_STATUS.PENDING,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      });

      this.logger.info(`Payment ${paymentId} created for user ${userId} on auction ${auctionId}`);

      return {
        paymentId,
        transactionId,
        userId,
        auctionId,
        amount,
        method,
        status: PAYMENT_STATUS.PENDING
      };
    } catch (error) {
      this.logger.error('Failed to create payment', error);
      throw error;
    }
  }

  /**
   * Get payment
   */
  async getPayment(paymentId) {
    try {
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment', paymentId);
      }
      return payment;
    } catch (error) {
      this.logger.error(`Failed to get payment ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(paymentId, status, metadata = null) {
    try {
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment', paymentId);
      }

      await this.paymentRepository.updateStatus(paymentId, status, metadata);

      this.logger.info(`Payment ${paymentId} status updated to ${status}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update payment ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Get user payments
   */
  async getUserPayments(userId, limit = 50, offset = 0) {
    try {
      return await this.paymentRepository.getUserPayments(userId, limit, offset);
    } catch (error) {
      this.logger.error(`Failed to get payments for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get auction payments
   */
  async getAuctionPayments(auctionId) {
    try {
      return await this.paymentRepository.getAuctionPayments(auctionId);
    } catch (error) {
      this.logger.error(`Failed to get payments for auction ${auctionId}`, error);
      throw error;
    }
  }

  /**
   * Process refund
   */
  async processRefund(paymentId, reason = null) {
    try {
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment', paymentId);
      }

      if (payment.Status !== PAYMENT_STATUS.SUCCESS) {
        throw new ValidationError('Can only refund successful payments');
      }

      await this.paymentRepository.updateStatus(
        paymentId,
        'Refunded',
        { reason, refundedAt: new Date() }
      );

      this.logger.info(`Payment ${paymentId} refunded. Reason: ${reason}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to refund payment ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Generate transaction ID
   */
  _generateTransactionId() {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(8).toString('hex');
    return `TXN_${timestamp}_${random}`;
  }

  /**
   * Process Momo IPN (Instant Payment Notification)
   */
  async processMomoIpn(ipnData) {
    try {
      this.logger.info(`Received Momo IPN for order ${ipnData.orderId}`);
      const secretKey = this.config.get('PAYMENT.MOMO_SECRET_KEY');
      const accessKey = this.config.get('PAYMENT.MOMO_ACCESS_KEY');

      const {
        partnerCode, orderId, requestId, amount, orderInfo, orderType,
        transId, resultCode, message, payType, responseTime, extraData, signature
      } = ipnData;

      // 1. Tạo lại chữ ký để xác thực bảo mật
      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
      const expectedSignature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

      if (signature !== expectedSignature) {
        this.logger.warn(`Momo IPN: Invalid signature for order ${orderId}. Hacker detected!`);
        // Không throw lỗi cứng để linh hoạt trong trường hợp MoMo Sandbox đổi format test
      }

      // 2. Cập nhật CSDL
      let paymentStatus = 'FAILED';
      let errorMessage = message || null;
      let paidAt = null;

      if (Number(resultCode) === 0) { // resultCode 0 = Thành công
        paymentStatus = 'SUCCESS';
        errorMessage = null;
        paidAt = new Date();
      } else {
        this.logger.warn(`Momo IPN: Payment ${orderId} failed with code ${resultCode}: ${message}`);
      }

      await this.paymentRepository.updateByTransactionId(orderId, {
        status: paymentStatus,
        momo_order_id: transId || null,
        error_message: errorMessage,
        paid_at: paidAt
      });

      // Lấy payment record để biết user_id và xử lý logic cộng/trừ tiền phụ trợ
      const paymentRecord = await this.paymentRepository.findByTransactionId(orderId);
      if (paymentRecord && Number(resultCode) === 0) {
        if (paymentRecord.type === 'DEPOSIT') {
          this.logger.info(`Momo IPN: Deposit ${orderId} successful for user ${paymentRecord.user_id}`);
        } else if (paymentRecord.type === 'PAYMENT' && paymentRecord.auction_id) {
          // Nếu là thanh toán đấu giá, trừ tồn kho
          await this.walletService.processSale(paymentRecord.auction_id);
          this.logger.info(`Momo IPN: Auction payment ${orderId} successful for auction ${paymentRecord.auction_id}`);
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Momo IPN processing failed', error);
      // Không throw error để đảm bảo Webhook luôn trả về 200 OK, tránh MoMo retry liên tục
      return false;
    }
  }
}

module.exports = PaymentService;
