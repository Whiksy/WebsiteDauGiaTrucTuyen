const nodemailer = require('nodemailer');
const { getLogger } = require('../logger');
const { getConfig } = require('../config');
const { getAuctionWinEmailTemplate, getPasswordResetEmailTemplate } = require('../utils/emailTemplates');

/**
 * Email Service - Quản lý việc gửi email thông báo
 * Tuân thủ OOP: Đóng gói toàn bộ logic cấu hình và gửi thư vào một class độc lập.
 */
class EmailService {
  constructor() {
    this.logger = getLogger('EmailService');
    this.config = getConfig().get('EMAIL');
    
    // Khởi tạo Transporter (cầu nối gửi mail) với cấu hình từ .env
    this.transporter = nodemailer.createTransport({
      host: this.config.SMTP_HOST,
      port: this.config.SMTP_PORT,
      secure: this.config.SMTP_PORT === 465, // true nếu dùng port 465, ngược lại false
      auth: {
        user: this.config.USERNAME,
        pass: this.config.PASSWORD,
      },
    });
  }

  async sendMail(to, subject, html) {
    try {
      const mailOptions = {
        from: `"Hệ thống Đấu Giá" <${this.config.FROM}>`,
        to,
        subject,
        html,
      };
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.info(`Đã gửi email thành công tới ${to}: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Lỗi khi gửi email tới ${to}`, error);
      return false;
    }
  }

  async sendAuctionWinEmail(buyerEmail, buyerName, productName, amount, auctionId = 0) {
    const subject = '🎉 Chúc mừng! Bạn đã thắng phiên đấu giá';
    
    // Tạo mã nhận hàng độc nhất từ ID Đấu giá (VD: AP-000123)
    const pickupCode = `AP-${String(auctionId).padStart(6, '0')}`;
    // Tạo link ảnh QR Code thông qua API miễn phí
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${pickupCode}`;

    // Lấy nội dung HTML từ file giao diện riêng biệt
    const html = getAuctionWinEmailTemplate(buyerName, productName, amount, pickupCode, qrCodeUrl);

    return this.sendMail(buyerEmail, subject, html);
  }

  async sendPasswordResetEmail(userEmail, userName, resetLink) {
    const subject = 'Yêu cầu đặt lại mật khẩu cho tài khoản AuctionPro';
    const html = getPasswordResetEmailTemplate(userName, resetLink);

    return this.sendMail(userEmail, subject, html);
  }
}

module.exports = EmailService;