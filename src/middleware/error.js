const { getLogger } = require('../logger');
const logger = getLogger('Middleware:Error');

// Từ điển dịch tự động các lỗi hệ thống sang tiếng Việt
const translateErrorMessage = (message) => {
  if (!message) return 'Lỗi không xác định';
  
  const dictionary = {
    'Invalid email or password': 'Email hoặc mật khẩu không chính xác.',
    'Email already registered': 'Email này đã được đăng ký trong hệ thống.',
    'No token provided': 'Vui lòng đăng nhập để thực hiện chức năng này.',
    'Invalid or expired token': 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
    'User not authenticated': 'Bạn chưa đăng nhập.',
    'Current password is incorrect': 'Mật khẩu hiện tại không chính xác.',
    'New password must be different from current password': 'Mật khẩu mới không được trùng với mật khẩu cũ.',
    'Auction is not active': 'Phiên đấu giá này hiện không hoạt động.',
    'Auction has ended': 'Phiên đấu giá này đã kết thúc.',
    'You are already the highest bidder. Other bidders must outbid you.': 'Bạn hiện đang là người trả giá cao nhất. Hãy đợi người khác ra giá.',
    'Cannot cancel auction with existing bids': 'Không thể hủy phiên đấu giá khi đã có người đặt giá.',
    'Can only refund successful payments': 'Chỉ có thể hoàn tiền cho những giao dịch đã thành công.',
    'A product can have a maximum of 5 images': 'Một sản phẩm chỉ được tải lên tối đa 5 ảnh. Vui lòng chọn lại.'
  };

  // Xử lý các câu lỗi động (chứa giá trị số/chữ thay đổi)
  if (message.includes('Bid must be at least')) {
    return message.replace('Bid must be at least', 'Giá đặt thầu phải từ')
                  .replace('(current bid is', '(giá hiện tại đang là')
                  .replace(')', ')');
  }
  if (message.includes('is required')) {
    return message.replace('is required and must be a string', 'là thông tin bắt buộc')
                  .replace('is required', 'là thông tin bắt buộc');
  }

  return dictionary[message] || message;
};

const errorHandler = (err, req, res, next) => {
  logger.error(`[${err.name}] ${err.message}`);
  const vietnameseMessage = translateErrorMessage(err.message);

  // GHI CHÚ Ý NGHĨA CÁC LOẠI LỖI TRONG HỆ THỐNG:
  // - PayloadTooLargeError: Xử lý lỗi dung lượng file/request quá lớn từ body-parser
  if (err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError') {
    return res.status(413).json({
      success: false,
      message: 'Dữ liệu tải lên quá lớn (ví dụ: hình ảnh có độ phân giải quá cao). Vui lòng giảm kích thước.'
    });
  }

  // - ValidationError: Lỗi nhập liệu do người dùng (VD: để trống form, giá đặt thầu quá thấp so với quy định).
  // - ConflictError: Lỗi xung đột dữ liệu (VD: đăng ký bằng email đã tồn tại trong CSDL).
  // - UnauthorizedError: Lỗi quyền truy cập (VD: nhập sai mật khẩu, mã Token hết hạn, cố truy cập khi chưa đăng nhập).
  if (err.name === 'ValidationError' || err.name === 'ConflictError' || err.name === 'UnauthorizedError') {
    return res.status(400).json({
      success: false,
      message: vietnameseMessage // Gửi câu lỗi tiếng Việt về cho màn hình UI
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.' : vietnameseMessage
  });
};

const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Không tìm thấy đường dẫn: ${req.originalUrl}`
  });
};

module.exports = { errorHandler, notFound };