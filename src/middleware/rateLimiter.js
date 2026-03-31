const rateLimit = require('express-rate-limit');

// 1. Giới hạn chung cho toàn bộ API (Chống DDoS diện rộng)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 500, // Tối đa 500 request / 15 phút / 1 IP
  message: { success: false, message: 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau 15 phút.' }
});

// 2. Giới hạn nghiêm ngặt cho API Đăng nhập/Đăng ký (Chống Brute-force dò mật khẩu)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Chỉ cho phép thử tối đa 10 lần
  message: { success: false, message: 'Bạn đã nhập sai hoặc thao tác quá nhiều lần. Vui lòng đợi 15 phút để thử lại.' }
});

// 3. Giới hạn cho Đặt giá (Chống Auto-click spam giá)
const bidLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 30, // Chỉ cho phép đặt tối đa 30 giá / 1 phút / 1 IP
  message: { success: false, message: 'Bạn đang đặt giá quá nhanh. Vui lòng chậm lại.' }
});

module.exports = { apiLimiter, authLimiter, bidLimiter };