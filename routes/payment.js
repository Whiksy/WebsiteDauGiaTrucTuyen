const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/appsettings');

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

// Create payment
router.post('/create', async (req, res) => {
  const { amount, orderId } = req.body;

  const requestId = `${Date.now()}`;
  const orderInfo = 'Payment for auction win';
  
  // Ưu tiên dùng PublicUrl từ config, nếu không có thì fallback về localhost
  const baseUrl = config.PublicUrl || 'http://localhost:5200';
  const redirectUrl = `${baseUrl}/payment/success`;
  const ipnUrl = `${baseUrl}/api/payment/ipn`;
  const requestType = 'payWithATM';

  const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${MOMO_CONFIG.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

  const signature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey).update(rawSignature).digest('hex');

  const requestBody = {
    partnerCode: MOMO_CONFIG.partnerCode,
    accessKey: MOMO_CONFIG.accessKey,
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    extraData: '',
    requestType,
    signature,
  };

  try {
    const response = await axios.post(MOMO_CONFIG.endpoint, requestBody);
    // Attach formatted amount for client convenience
    const resp = response.data || {};
    resp.formattedAmount = formatVND(amount);
    res.json(resp);
  } catch (error) {
    console.error('/api/payment/create error:', error && (error.stack || error));
    res.status(500).json({ error: error.message });
  }
});

// IPN handler
router.post('/ipn', (req, res) => {
  // Handle IPN from Momo
  try {
    console.log('IPN received:', req.body);
    // TODO: validate signature and update order/payment status in DB
    res.status(200).send('OK');
  } catch (error) {
    console.error('/api/payment/ipn error:', error && (error.stack || error));
    res.status(500).send('ERROR');
  }
});

module.exports = router;