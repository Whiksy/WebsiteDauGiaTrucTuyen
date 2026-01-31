const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/appsettings');
const { sql } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Momo config
const MOMO_CONFIG = {
  partnerCode: config.Momo.PartnerCode,
  accessKey: config.Momo.AccessKey,
  secretKey: config.Momo.SecretKey,
  endpoint: config.Momo.Endpoint,
};

const formatVND = (amount) => {
  try {
    return Number(amount).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
  } catch (e) {
    console.error('formatVND error:', e && (e.stack || e));
    return `${amount} VND`;
  }
};

// Helper: Create Momo Signature
const createSignature = (rawSignature) => {
    return crypto.createHmac('sha256', MOMO_CONFIG.secretKey).update(rawSignature).digest('hex');
};

// 1. Nạp tiền vào ví (Deposit)
router.post('/deposit', verifyToken, async (req, res) => {
  const { amount } = req.body;
  const userId = req.userId;

  if (!amount || amount < 1000) {
      return res.status(400).json({ message: 'Số tiền nạp tối thiểu là 1,000 VND' });
  }

  const orderId = `MOMO_DEPOSIT_${Date.now()}_${userId}`;
  const requestId = orderId;
  const orderInfo = `Nap tien vao vi User ${userId}`;
  
  const baseUrl = config.PublicUrl || 'http://localhost:5200';
  const redirectUrl = `${baseUrl}/payment/success`;
  const ipnUrl = `${baseUrl}/api/payment/ipn`;
  const requestType = 'captureWallet';
  const extraData = ''; // Lưu Type=Deposit vào extraData nếu cần, hoặc dựa vào prefix orderId

  // Lưu DB trước khi gọi Momo
  try {
      const pool = await sql.connect();
      await pool.request()
          .input('userId', sql.Int, userId)
          .input('amount', sql.Decimal(18, 2), amount)
          .input('orderId', sql.NVarChar, orderId)
          .query("INSERT INTO Payments (UserId, Amount, Status, Type, MomoOrderId) VALUES (@userId, @amount, 'Pending', 'Deposit', @orderId)");
  } catch (dbError) {
      return res.status(500).json({ error: 'Database error: ' + dbError.message });
  }

  const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${MOMO_CONFIG.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
  const signature = createSignature(rawSignature);

  const requestBody = {
    partnerCode: MOMO_CONFIG.partnerCode,
    accessKey: MOMO_CONFIG.accessKey,
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    extraData,
    requestType,
    signature,
  };

  try {
    const response = await axios.post(MOMO_CONFIG.endpoint, requestBody);
    // Attach formatted amount for client convenience
    res.json({ ...response.data, formattedAmount: formatVND(amount) });
  } catch (error) {
    console.error('/api/payment/deposit error:', error && (error.stack || error));
    res.status(500).json({ error: error.message });
  }
});

// 2. Thanh toán đơn hàng đấu giá (Auction Payment)
router.post('/create', verifyToken, async (req, res) => {
  const { amount, auctionId } = req.body;
  const userId = req.userId;

  // FIX: Bắt buộc phải có auctionId để tránh lưu NULL vào DB
  if (!auctionId) {
      return res.status(400).json({ message: 'Thiếu thông tin phiên đấu giá (AuctionId)' });
  }

  const orderId = `MOMO_AUCTION_${Date.now()}_${userId}_${auctionId}`;
  const requestId = orderId;
  const orderInfo = `Thanh toan dau gia #${auctionId}`;
  
  const baseUrl = config.PublicUrl || 'http://localhost:5200';
  const redirectUrl = `${baseUrl}/payment/success`;
  const ipnUrl = `${baseUrl}/api/payment/ipn`;
  const requestType = 'captureWallet';
  const extraData = '';

  try {
      const pool = await sql.connect();
      await pool.request()
          .input('userId', sql.Int, userId)
          .input('auctionId', sql.Int, auctionId)
          .input('amount', sql.Decimal(18, 2), amount)
          .input('orderId', sql.NVarChar, orderId)
          .query("INSERT INTO Payments (UserId, AuctionId, Amount, Status, Type, MomoOrderId) VALUES (@userId, @auctionId, @amount, 'Pending', 'Auction', @orderId)");
  } catch (dbError) {
      return res.status(500).json({ error: 'Database error: ' + dbError.message });
  }

  const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${MOMO_CONFIG.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
  const signature = createSignature(rawSignature);

  const requestBody = {
    partnerCode: MOMO_CONFIG.partnerCode,
    accessKey: MOMO_CONFIG.accessKey,
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    extraData,
    requestType,
    signature,
  };

  try {
    const response = await axios.post(MOMO_CONFIG.endpoint, requestBody);
    res.json({ ...response.data, formattedAmount: formatVND(amount) });
  } catch (error) {
    console.error('/api/payment/create error:', error && (error.stack || error));
    res.status(500).json({ error: error.message });
  }
});

// 3. IPN Handler (Xử lý kết quả thanh toán từ Momo)
router.post('/ipn', async (req, res) => {
  const {
      partnerCode, orderId, requestId, amount, orderInfo, orderType, transId, resultCode, message, payType, responseTime, extraData, signature
  } = req.body;

  console.log('🔔 [Momo IPN] Received:', req.body);

  // 1. Verify Signature
  const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
  const generatedSignature = createSignature(rawSignature);

  if (generatedSignature !== signature) {
      console.error('❌ [Momo IPN] Invalid Signature');
      return res.status(400).json({ message: 'Invalid signature' });
  }

  // 2. Process Payment
  if (resultCode == 0) { // 0 = Thành công
      try {
          const pool = await sql.connect();
          
          // Lấy thông tin giao dịch
          const paymentRes = await pool.request()
              .input('orderId', sql.NVarChar, orderId)
              .query("SELECT * FROM Payments WHERE MomoOrderId = @orderId");

          if (paymentRes.recordset.length > 0) {
              const payment = paymentRes.recordset[0];
              
              if (payment.Status !== 'Paid') {
                  // Cập nhật trạng thái Payment
                  await pool.request()
                      .input('orderId', sql.NVarChar, orderId)
                      .query("UPDATE Payments SET Status = 'Paid' WHERE MomoOrderId = @orderId");

                  // Nếu là nạp tiền (Deposit) -> Cộng tiền vào User Balance
                  if (payment.Type === 'Deposit') {
                      const updateRes = await pool.request()
                          .input('amount', sql.Decimal(18, 2), payment.Amount)
                          .input('userId', sql.Int, payment.UserId)
                          .query("UPDATE Users SET Money = ISNULL(Money, 0) + @amount OUTPUT INSERTED.Money WHERE Id = @userId");
                      
                      console.log(`💰 [Wallet] Added ${payment.Amount} to User ${payment.UserId}`);
                      
                      // Realtime update balance
                      const io = req.app.get('io');
                      if (io) {
                          io.to(`user_${payment.UserId}`).emit('balanceUpdate', { balance: updateRes.recordset[0].Money });
                      }
                  }
                  
                  // Nếu là Auction -> Logic xử lý sau (VD: gửi mail, noti)
                  if (payment.Type === 'Auction') {
                      // FIX: Xử lý hoàn tất đơn hàng khi thanh toán Momo thành công
                      if (payment.AuctionId) {
                          console.log(`🔨 [Auction] Payment confirmed for Auction ${payment.AuctionId}`);
                          
                          // 1. Cập nhật trạng thái Auction thành 'Ended' (Hoàn tất)
                          await pool.request()
                              .input('aid', sql.Int, payment.AuctionId)
                              .query("UPDATE Auctions SET Status = 'Ended' WHERE Id = @aid");

                          // 2. Cộng tiền cho Seller (Người bán)
                          const auctionInfo = await pool.request()
                              .input('aid', sql.Int, payment.AuctionId)
                              .query(`
                                  SELECT p.SellerId 
                                  FROM Auctions a 
                                  JOIN Products p ON a.ProductId = p.Id 
                                  WHERE a.Id = @aid
                              `);
                          
                          if (auctionInfo.recordset.length > 0 && auctionInfo.recordset[0].SellerId) {
                              const sellerId = auctionInfo.recordset[0].SellerId;
                              const creditRes = await pool.request()
                                  .input('amount', sql.Decimal(18, 2), payment.Amount)
                                  .input('uid', sql.Int, sellerId)
                                  .query("UPDATE Users SET Money = ISNULL(Money, 0) + @amount OUTPUT INSERTED.Money WHERE Id = @uid");
                              
                              // Gửi thông báo Socket cho Seller
                              const io = req.app.get('io');
                              if (io) {
                                  io.to(`user_${sellerId}`).emit('balanceUpdate', { balance: creditRes.recordset[0].Money });
                                  io.to(`user_${sellerId}`).emit('productSold', { auctionId: payment.AuctionId, message: `Sản phẩm #${payment.AuctionId} đã được thanh toán qua Momo.` });
                              }
                          }
                      } else {
                          console.error('❌ [Momo IPN] Lỗi nghiêm trọng: Payment Type=Auction nhưng AuctionId bị NULL. Không thể hoàn tất đơn hàng.');
                      }
                  }
              }
          }
      } catch (err) {
          console.error('❌ [Momo IPN] DB Error:', err);
          return res.status(500).json({ message: 'Internal Server Error' });
      }
  } else {
      console.log('⚠️ [Momo IPN] Transaction failed:', message);
      try {
          const pool = await sql.connect();
          await pool.request()
              .input('orderId', sql.NVarChar, orderId)
              .query("UPDATE Payments SET Status = 'Failed' WHERE MomoOrderId = @orderId");
      } catch (e) { console.error('❌ [Momo IPN] DB Error update failed status:', e); }
  }

  res.status(204).send(); // Momo expects 204 or 200
});

// 4. Kiểm tra trạng thái giao dịch (Frontend gọi sau khi redirect về)
// Bỏ verifyToken để cho phép kiểm tra trạng thái khi redirect khác trình duyệt (Momo App -> Browser)
router.get('/status/:orderId', async (req, res) => {
    const { orderId } = req.params;
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('orderId', sql.NVarChar, orderId)
            .query("SELECT Status, Amount, Type FROM Payments WHERE MomoOrderId = @orderId");

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Giao dịch không tồn tại' });
        }

        const payment = result.recordset[0];
        res.json({ 
            status: payment.Status, 
            amount: payment.Amount, 
            type: payment.Type,
            formattedAmount: formatVND(payment.Amount)
        });
    } catch (error) {
        console.error('/api/payment/status error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;