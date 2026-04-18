const crypto = require('crypto');
const axios = require('axios');
const { getLogger } = require('../logger');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { ValidationError } = require('../errors');
const { getConfig } = require('../config');

/**
 * Wallet Service - Quản lý nạp tiền và thống kê số dư chuẩn OOP
 */
class WalletService {
  constructor() {
    // Sử dụng BaseRepository để tái sử dụng hàm executeQuery
    this.db = RepositoryFactory.getUserRepository(); 
    this.logger = getLogger('WalletService');
  }

  async getBalanceStats(userId) {
    try {
      // Tối ưu: Gộp 3 truy vấn con thành 1
      const userPaymentsQuery = `
        SELECT
          SUM(IF(type = 'DEPOSIT' AND status = 'SUCCESS', amount, 0)) as totalDeposit,
          SUM(IF(type = 'PAYMENT' AND status = 'SUCCESS', amount, 0)) as totalAuctionPayments,
          SUM(IF(type = 'WITHDRAWAL' AND status IN ('SUCCESS', 'PENDING'), amount, 0)) as totalWithdrawal
        FROM Payments
        WHERE user_id = @userId
      `;
      const salesQuery = `SELECT COALESCE(SUM(p.amount), 0) as totalSales FROM Payments p JOIN Auctions a ON p.auction_id = a.id WHERE a.seller_id = @userId AND p.status = 'SUCCESS'`;
      
      const [userPaymentsResult, salesResult] = await Promise.all([
        this.db.executeQuery(userPaymentsQuery, { userId }),
        this.db.executeQuery(salesQuery, { userId })
      ]);
      
      const stats = { ...(userPaymentsResult[0] || {}), ...(salesResult[0] || {}) };
      const totalDeposit = Number(stats.totalDeposit || 0);
      const totalSales = Number(stats.totalSales || 0);
      const totalAuctionPayments = Number(stats.totalAuctionPayments || 0);
      const totalWithdrawal = Number(stats.totalWithdrawal || 0);
      
      const totalIncome = totalDeposit + totalSales;
      const totalExpense = totalAuctionPayments + totalWithdrawal;
      const balance = totalIncome - totalExpense;

      return { balance, totalIncome, totalExpense, totalSales, totalDeposit, totalWithdrawal };
    } catch (error) {
      this.logger.error(`Failed to get balance stats for user ${userId}`, error);
      throw error;
    }
  }

  async deposit(userId, amount, customReturnUrl = null) {
    const depositAmount = Number(amount);
    if (!depositAmount || depositAmount < 1000 || depositAmount > 1000000000) {
      throw new ValidationError('Số tiền nạp phải từ 1.000 ₫ đến 1.000.000.000 ₫');
    }

    const transactionId = 'DEP_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    await this.db.executeQuery(`
      INSERT INTO Payments (user_id, amount, type, transaction_id, status)
      VALUES (@userId, @amount, 'DEPOSIT', @txn, 'PENDING')
    `, { userId, amount: depositAmount, txn: transactionId });

    this.logger.info(`User ${userId} requested deposit ${depositAmount} (PENDING)`);

    // Tích hợp API Momo thật
    const config = getConfig();
    const momoConfig = config.get('PAYMENT');
    
    const partnerCode = momoConfig.MOMO_PARTNER_CODE;
    const accessKey = momoConfig.MOMO_ACCESS_KEY;
    const secretKey = momoConfig.MOMO_SECRET_KEY;
    const endpoint = momoConfig.MOMO_ENDPOINT;
    const redirectUrl = customReturnUrl || momoConfig.RETURN_URL;
    const ipnUrl = momoConfig.NOTIFY_URL;
    
    // Lấy thông tin người dùng để hiển thị chuyên nghiệp trên app MoMo
    const user = await this.db.findById(userId);
    const userName = user && user.full_name ? user.full_name : `Khach hang ${userId}`;
    
    // Hàm loại bỏ dấu tiếng Việt an toàn để tránh lỗi chữ ký HMAC của MoMo
    const safeUserName = userName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

    const orderId = transactionId;
    const requestType = "captureWallet";
    const orderInfo = `Auction Website - Nap tien cho: ${safeUserName}`; 
    // Gói thêm email vào extraData dạng Base64 theo chuẩn thực tế
    const extraData = Buffer.from(JSON.stringify({ userEmail: user ? user.email : 'Unknown' })).toString('base64');
    
    const rawSignature = `accessKey=${accessKey}&amount=${depositAmount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${orderId}&requestType=${requestType}`;
    const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
    
    const requestBody = {
      partnerCode,
      accessKey,
      requestId: orderId,
      amount: depositAmount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature,
      lang: 'vi'
    };

    let response;
    try {
      response = await axios.post(endpoint, requestBody);
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.error('Momo request failed', error.response ? error.response.data : error.message);
      throw new ValidationError(`Lỗi kết nối MoMo: ${errMsg}`);
    }

    if (response.data && response.data.payUrl) {
      return { transactionId, amount: depositAmount, payUrl: response.data.payUrl };
    } else {
      this.logger.error('Momo API error', response.data);
      const errorMsg = response.data ? (response.data.localMessage || response.data.message) : 'Không xác định';
      throw new ValidationError(`MoMo từ chối: ${errorMsg}`);
    }
  }

  /**
   * Xử lý yêu cầu rút tiền của người dùng
   */
  async withdraw(userId, amount, momoPhoneNumber) {
    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount < 10000) {
      throw new ValidationError('Số tiền rút tối thiểu là 10.000 ₫');
    }
    if (!momoPhoneNumber || !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(momoPhoneNumber)) {
      throw new ValidationError('Số điện thoại Momo không hợp lệ.');
    }

    // 1. Kiểm tra số dư
    const balanceStats = await this.getBalanceStats(userId);
    if (balanceStats.balance < withdrawAmount) {
      throw new ValidationError(`Số dư không đủ. Số dư hiện tại của bạn là ${balanceStats.balance.toLocaleString('vi-VN')} ₫`);
    }

    // 2. Tạo bản ghi giao dịch rút tiền
    const transactionId = 'WDR_' + Date.now() + '_' + userId;
    await this.db.executeQuery(`
      INSERT INTO Payments (user_id, amount, type, transaction_id, status, momo_order_id)
      VALUES (@userId, @amount, 'WITHDRAWAL', @txn, 'PENDING', @phone)
    `, { userId, amount: withdrawAmount, txn: transactionId, phone: momoPhoneNumber });

    this.logger.info(`User ${userId} requested withdrawal of ${withdrawAmount} to ${momoPhoneNumber}. Status: PENDING for Admin approval.`);

    // Đã gỡ bỏ gọi API MoMo Chi hộ (do Sandbox MoMo báo lỗi 404)
    // Chuyển sang luồng: Chờ Admin duyệt thủ công
    return { success: true, message: 'Yêu cầu rút tiền đang chờ Admin xử lý và chuyển khoản.' };
  }

  /**
   * Tự động thanh toán cho phiên đấu giá đã thắng
   */
  async payForWonAuction(auctionId, userId, amount, connection) {
    const paymentAmount = Number(amount);
    const repo = connection ? { executeQuery: connection.query.bind(connection) } : this.db;
    
    // 1. Kiểm tra xem đã thanh toán thành công trước đó chưa (Chống trừ tiền 2 lần)
    const existingSuccess = await repo.executeQuery(
        "SELECT id FROM Payments WHERE auction_id = @auctionId AND user_id = @userId AND status = 'SUCCESS'",
        { auctionId, userId }
    );
    if (existingSuccess.length > 0) return true;

    // 2. Kiểm tra số dư ví
    const stats = await this.getBalanceStats(userId);
    const txn = 'PAY_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    if (stats.balance >= paymentAmount) {
        this.logger.info(`[Auto-Payment] Bắt đầu tính tiền: Người thắng (User ${userId}) có số dư ${stats.balance} ₫ >= giá thắng ${paymentAmount} ₫.`);
        // Đủ tiền: Xóa các log lỗi (nếu có) và tạo giao dịch thành công
        await repo.executeQuery(
            "DELETE FROM Payments WHERE auction_id = @auctionId AND user_id = @userId AND status = 'FAILED'",
            { auctionId, userId }
        );

        // Trừ tiền người mua
        await repo.executeQuery(`
            INSERT INTO Payments (auction_id, user_id, amount, type, transaction_id, status, paid_at, created_at)
            VALUES (@auctionId, @userId, @amount, 'PAYMENT', @txn, 'SUCCESS', NOW(), NOW())
        `, { auctionId, userId, amount: paymentAmount, txn });
        this.logger.info(`[Auto-Payment] Đã TRỪ ${paymentAmount} ₫ từ ví người mua (User ${userId}).`);

        // Lấy seller_id để cộng tiền
        const auctionInfo = await repo.executeQuery('SELECT seller_id FROM Auctions WHERE id = @auctionId', { auctionId });
        const sellerId = auctionInfo[0]?.seller_id;

        if (sellerId) {
            // Cộng tiền cho người bán
            const sellerTxn = 'SALE_' + Date.now() + '_' + sellerId;
            await repo.executeQuery(`
                INSERT INTO Payments (auction_id, user_id, amount, type, transaction_id, status, paid_at, created_at)
                VALUES (@auctionId, @sellerId, @amount, 'DEPOSIT', @txn, 'SUCCESS', NOW(), NOW())
            `, { auctionId, sellerId, amount: paymentAmount, txn: sellerTxn });
            this.logger.info(`[Auto-Payment] Đã CỘNG ${paymentAmount} ₫ vào ví người bán (Seller ${sellerId}) từ đấu giá ${auctionId}.`);
        }

        // Trừ tồn kho sản phẩm
        await this.processSale(auctionId);
        this.logger.info(`[Auto-Payment] Giao dịch cho đấu giá ${auctionId} hoàn tất thành công.`);
        return true;
    } else {
        this.logger.warn(`[Auto-Payment] Thất bại: Người mua (User ${userId}) chỉ còn ${stats.balance} ₫, không đủ thanh toán ${paymentAmount} ₫.`);
        // Không đủ tiền: Ghi nhận giao dịch thất bại nếu chưa có
        const existingFailed = await repo.executeQuery(
            "SELECT id FROM Payments WHERE auction_id = @auctionId AND user_id = @userId AND status = 'FAILED'",
            { auctionId, userId }
        );
        if (existingFailed.length === 0) {
            await repo.executeQuery(`
                INSERT INTO Payments (auction_id, user_id, amount, type, transaction_id, status, error_message, created_at)
                VALUES (@auctionId, @userId, @amount, 'PAYMENT', @txn, 'FAILED', 'Số dư không đủ. Vui lòng nạp thêm tiền.', NOW())
            `, { auctionId, userId, amount: paymentAmount, txn });
        }
        return false;
    }
  }

  /**
   * Xử lý hậu mãi sau khi thanh toán thành công cho một phiên đấu giá.
   * CHỨC NĂNG QUAN TRỌNG: Giảm số lượng tồn kho của sản phẩm.
   * @param {number} auctionId - ID của phiên đấu giá đã được thanh toán.
   * @returns {Promise<boolean>}
   */
  async processSale(auctionId) {
    if (!auctionId) {
      this.logger.warn('[processSale] Called with null auctionId.');
      return false;
    }

    try {
      // Lấy product_id từ auction_id
      const auctionResult = await this.db.executeQuery(
        'SELECT product_id FROM Auctions WHERE id = @auctionId',
        { auctionId }
      );

      if (!auctionResult || auctionResult.length === 0) {
        this.logger.error(`[processSale] Could not find auction with ID: ${auctionId}`);
        return false;
      }

      const productId = auctionResult[0].product_id;

      // Giảm tồn kho đi 1
      await this.db.executeQuery(
        'UPDATE Products SET stock = stock - 1 WHERE id = @productId AND stock > 0',
        { productId }
      );

      // Kiểm tra kho sau khi trừ
      const productStock = await this.db.executeQuery('SELECT stock FROM Products WHERE id = @productId', { productId });
      if (productStock && productStock.length > 0) {
        this.logger.info(`[processSale] Đã xử lý tồn kho. Sản phẩm ${productId} hiện còn: ${productStock[0].stock} sản phẩm.`);
      }

      return true;
    } catch (error) {
      this.logger.error(`[processSale] Failed to process sale for auction ${auctionId}`, error);
      // Ném lỗi để lớp gọi (ví dụ: PaymentService) có thể xử lý transaction rollback nếu cần
      throw error;
    }
  }

  /**
   * Lấy lịch sử giao dịch của người dùng
   */
  async getTransactions(userId, limit = 50) {
    try {
      const transactions = await this.db.executeQuery(`
        SELECT id, momo_order_id as momoOrderId, amount, status, created_at as createdAt, type
        FROM Payments
        WHERE user_id = @userId
        ORDER BY created_at DESC
        LIMIT @limit
      `, { userId, limit });
      return transactions.map(t => ({ ...t, formattedAmount: Number(t.amount).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }) }));
    } catch (error) {
      this.logger.error(`Failed to get transactions for user ${userId}`, error);
      throw error;
    }
  }
}

module.exports = WalletService;