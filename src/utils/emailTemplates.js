/**
 * emailTemplates.js
 * Chứa các mẫu HTML giao diện cho email.
 * Giúp tách biệt phần hiển thị (UI) ra khỏi logic gửi mail (Service).
 */

const getAuctionWinEmailTemplate = (buyerName, productName, amount, pickupCode, qrCodeUrl) => {
  const currentYear = new Date().getFullYear();
  
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f6; padding: 30px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
              <!-- Header -->
              <tr>
                <td style="background-color: #1e293b; padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 26px; letter-spacing: 2px;">AUCTION PRO</h1>
                </td>
              </tr>
              <!-- Body Content -->
              <tr>
                <td style="padding: 40px 40px 20px 40px;">
                  <h2 style="color: #333333; margin-top: 0;">Chúc mừng ${buyerName}! 🎉</h2>
                  <p style="color: #555555; font-size: 16px; line-height: 1.6;">Bạn đã xuất sắc chiến thắng phiên đấu giá. Hệ thống đã tự động thanh toán thành công. Dưới đây là thông tin chi tiết đơn hàng của bạn.</p>
                  <!-- Order Details Box -->
                  <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 4px;">
                    <p style="margin: 5px 0; color: #475569; font-size: 15px;"><strong>Sản phẩm:</strong> ${productName}</p>
                    <p style="margin: 5px 0; color: #475569; font-size: 15px;"><strong>Giá thanh toán:</strong> <span style="color: #10b981; font-weight: bold; font-size: 18px;">${Number(amount).toLocaleString('vi-VN')} ₫</span></p>
                  </div>
                  <!-- QR Code Section -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px; border-top: 1px dashed #e2e8f0; padding-top: 30px;">
                    <tr>
                      <td align="center">
                        <h3 style="color: #1e293b; margin-top: 0; font-size: 18px;">Mã Nhận Hàng</h3>
                        <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">Vui lòng đưa mã QR này cho người bán để quét xác nhận khi nhận hàng.</p>
                        <img src="${qrCodeUrl}" alt="QR Code" width="150" height="150" style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 5px;" />
                        <div style="margin-top: 15px; font-size: 24px; font-weight: bold; color: #0f172a; letter-spacing: 3px;">${pickupCode}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f1f5f9; padding: 20px 30px; text-align: center; color: #64748b; font-size: 13px;">
                  <p style="margin: 0 0 5px 0;">Email này được tạo tự động từ hệ thống.</p>
                  <p style="margin: 0;">&copy; ${currentYear} AuctionPro. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

const getPasswordResetEmailTemplate = (userName, resetLink) => {
  const currentYear = new Date().getFullYear();

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f6; padding: 30px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
              <!-- Header -->
              <tr>
                <td style="background-color: #1e293b; padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 26px; letter-spacing: 2px;">AUCTION PRO</h1>
                </td>
              </tr>
              <!-- Body Content -->
              <tr>
                <td style="padding: 40px 40px 20px 40px;">
                  <h2 style="color: #333333; margin-top: 0;">Yêu cầu đặt lại mật khẩu</h2>
                  <p style="color: #555555; font-size: 16px; line-height: 1.6;">Xin chào ${userName},</p>
                  <p style="color: #555555; font-size: 16px; line-height: 1.6;">Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhấp vào nút bên dưới để tạo mật khẩu mới. Liên kết này sẽ hết hạn sau 15 phút.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background-color: #3b82f6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Đặt lại mật khẩu</a>
                  </div>
                  <p style="color: #555555; font-size: 16px; line-height: 1.6;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f1f5f9; padding: 20px 30px; text-align: center; color: #64748b; font-size: 13px;">
                  <p style="margin: 0;">&copy; ${currentYear} AuctionPro. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

module.exports = {
  getAuctionWinEmailTemplate,
  getPasswordResetEmailTemplate
};