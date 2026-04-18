const express = require('express');
const crypto = require('crypto');
const { ServiceFactory } = require('../services/ServiceFactory');
const { authenticate } = require('../middleware');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { getConfig } = require('../config');

const router = express.Router();
const paymentService = ServiceFactory.getPaymentService();
const walletService = ServiceFactory.getWalletService();

/**
 * @route   GET /api/payments/history
 * @desc    Get user payment history
 * @access  Private
 */
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const payments = await paymentService.getUserPayments(req.userId, limit, offset);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: { limit, offset }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/payments/deposit
 * @desc    Nạp tiền vào ví (Giả lập thanh toán thành công)
 * @access  Private
 */
router.post('/deposit', authenticate, async (req, res, next) => {
  try {
    // Tự động nhận diện domain đang truy cập (localhost hoặc ngrok)
    let baseUrl = getConfig().get('PUBLIC_URL');
    if (req.headers.origin) {
      baseUrl = req.headers.origin;
    } else if (req.headers.referer) {
      baseUrl = new URL(req.headers.referer).origin;
    }
    const returnUrl = `${baseUrl}/payment/success`;

    const result = await walletService.deposit(req.userId, req.body.amount, returnUrl);

    res.status(200).json({
      success: true,
      message: 'Đang chuyển hướng tới cổng thanh toán...',
      data: result,
      payUrl: result.payUrl 
    });
  } catch (error) { next(error); }
});

/**
 * @route   GET /api/payments/status/:transactionId
 * @desc    Lấy trạng thái giao dịch (Dùng cho giao diện chờ cập nhật UI)
 * @access  Public
 */
router.get('/status/:transactionId', async (req, res, next) => {
  try {
    const paymentRecord = await RepositoryFactory.getPaymentRepository().findByTransactionId(req.params.transactionId);
    if (!paymentRecord) {
      return res.status(404).json({ success: false, message: 'Giao dịch không tồn tại' });
    }
    res.status(200).json({ 
      success: true, 
      data: paymentRecord
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/payments/ipn
 * @desc    IPN (Webhook) từ Momo để xác nhận thanh toán tự động
 */
router.post('/ipn', async (req, res, next) => {
  try {
    await paymentService.processMomoIpn(req.body);
    res.status(200).json({ message: 'Success' }); // Momo requires 200 OK
  } catch (error) { next(error); }
});

/**
 * @route   POST /api/payments/create
 * @desc    Create payment
 * @access  Private
 */
router.post('/create', authenticate, async (req, res, next) => {
  try {
    const { auctionId, amount, method } = req.body;

    const payment = await paymentService.createPayment(
      req.userId,
      auctionId,
      amount,
      method || 'Momo'
    );

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: payment
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/payments/complete
 * @desc    Complete payment (IPN from gateway)
 * @access  Public
 */
router.post('/complete', async (req, res, next) => {
  try {
    const { paymentId, transactionId, status } = req.body;

    // Verify signature if needed
    await paymentService.updatePaymentStatus(paymentId, 'Success', {
      transactionId,
      gateway: 'Momo',
      completedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Payment completed'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
