-- ============================================================================
-- Cơ Sở Dữ Liệu Hệ Thống Đấu Giá Thời Gian Thực
-- Tên: AuctionWebsite
-- DBMS: MySQL 8.0+ hoặc MariaDB 10.5+
-- ============================================================================
-- Tạo cơ sở dữ liệu
CREATE DATABASE IF NOT EXISTS AuctionWebsite
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE AuctionWebsite;

-- ============================================================================
-- Bảng Người Dùng
-- ============================================================================
CREATE TABLE IF NOT EXISTS Users (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID người dùng',
  email VARCHAR(255) UNIQUE NOT NULL COMMENT 'Email (dùng để đăng nhập)',
  password_hash VARCHAR(255) COMMENT 'Hash mật khẩu (bcrypt)',
  full_name VARCHAR(255) COMMENT 'Tên đầy đủ',
  avatar LONGBLOB COMMENT 'Ảnh đại diện (lưu dạng base64 hoặc binary)',
  phone VARCHAR(20) COMMENT 'Số điện thoại',
  address VARCHAR(500) COMMENT 'Địa chỉ',
  city VARCHAR(100) COMMENT 'Thành phố',
  postal_code VARCHAR(20) COMMENT 'Mã bưu điện',
  country VARCHAR(100) COMMENT 'Quốc gia',
  bio TEXT COMMENT 'Tiểu sử người dùng',
  rating DECIMAL(3, 2) DEFAULT 5.00 COMMENT 'Xếp hạng (0-5)',
  total_auctions_won INT DEFAULT 0 COMMENT 'Tổng đấu giá thắng',
  total_items_sold INT DEFAULT 0 COMMENT 'Tổng mục bán',
  is_verified BOOLEAN DEFAULT FALSE COMMENT 'Tài khoản đã xác minh',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Tài khoản đang hoạt động',
  google_id VARCHAR(255) UNIQUE COMMENT 'Google OAuth ID',
  facebook_id VARCHAR(255) UNIQUE COMMENT 'Facebook OAuth ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Lần cập nhật cuối',
  
  INDEX idx_email (email),
  INDEX idx_created_at (created_at),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng người dùng';

-- ============================================================================
-- Bảng Vai Trò
-- ============================================================================
CREATE TABLE IF NOT EXISTS Roles (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID vai trò',
  name VARCHAR(50) UNIQUE NOT NULL COMMENT 'Tên vai trò (ADMIN, SELLER, BUYER, USER)',
  description VARCHAR(255) COMMENT 'Mô tả vai trò',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng vai trò';

-- Thêm vai trò mặc định
INSERT IGNORE INTO Roles (name, description) VALUES
('ADMIN', 'Quản trị viên hệ thống'),
('SELLER', 'Người bán hàng'),
('BUYER', 'Người mua hàng'),
('USER', 'Người dùng thường');

-- ============================================================================
-- Bảng Liên Kết Người Dùng - Vai Trò
-- ============================================================================
CREATE TABLE IF NOT EXISTS UserRoles (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID liên kết',
  user_id INT NOT NULL COMMENT 'ID người dùng',
  role_id INT NOT NULL COMMENT 'ID vai trò',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày gán',
  
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES Roles(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_role (user_id, role_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng liên kết người dùng với vai trò';

-- ============================================================================
-- Bảng Danh Mục
-- ============================================================================
CREATE TABLE IF NOT EXISTS Categories (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID danh mục',
  name VARCHAR(255) NOT NULL COMMENT 'Tên danh mục',
  description TEXT COMMENT 'Mô tả danh mục',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Lần cập nhật cuối'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng danh mục sản phẩm';

-- ============================================================================
-- Bảng Sản Phẩm
-- ============================================================================
CREATE TABLE IF NOT EXISTS Products (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID sản phẩm',
  seller_id INT NOT NULL COMMENT 'ID người bán',
  name VARCHAR(255) NOT NULL COMMENT 'Tên sản phẩm',
  description TEXT COMMENT 'Mô tả chi tiết',
  category_id INT COMMENT 'ID Danh mục',
  price_starting DECIMAL(15, 2) NOT NULL COMMENT 'Giá khởi điểm',
  `condition` VARCHAR(50) COMMENT 'Tình trạng (Mới, Như mới, Đã sử dụng)',
  brand VARCHAR(100) COMMENT 'Thương hiệu',
  sku VARCHAR(100) UNIQUE COMMENT 'Mã SKU',
  stock INT DEFAULT 1 COMMENT 'Số lượng kho',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Sản phẩm còn hoạt động',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Lần cập nhật cuối',
  
  FOREIGN KEY (seller_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES Categories(id) ON DELETE SET NULL,
  INDEX idx_seller_id (seller_id),
  INDEX idx_category_id (category_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng sản phẩm';

-- ============================================================================
-- Bảng Hình Ảnh Sản Phẩm
-- ============================================================================
CREATE TABLE IF NOT EXISTS ProductImages (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID hình ảnh',
  product_id INT NOT NULL COMMENT 'ID sản phẩm',
  image LONGBLOB COMMENT 'Dữ liệu hình ảnh (base64 hoặc binary)',
  image_mime_type VARCHAR(50) DEFAULT 'image/jpeg' COMMENT 'Loại MIME (image/jpeg, image/png, v.v.)',
  is_primary BOOLEAN DEFAULT FALSE COMMENT 'Hình ảnh chính (thumbnail)',
  display_order INT DEFAULT 0 COMMENT 'Thứ tự hiển thị',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày thêm',
  
  FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE CASCADE,
  INDEX idx_product_id (product_id),
  INDEX idx_is_primary (is_primary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng hình ảnh sản phẩm';

-- ============================================================================
-- Bảng Đấu Giá
-- ============================================================================
CREATE TABLE IF NOT EXISTS Auctions (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID đấu giá',
  product_id INT NOT NULL COMMENT 'ID sản phẩm',
  seller_id INT NOT NULL COMMENT 'ID người bán',
  starting_price DECIMAL(15, 2) NOT NULL COMMENT 'Giá khởi điểm',
  current_price DECIMAL(15, 2) NOT NULL COMMENT 'Giá hiện tại',
  highest_bidder_id INT COMMENT 'ID người nấu giá cao nhất',
  reserve_price DECIMAL(15, 2) COMMENT 'Giá dự trữ (giá tối thiểu cuối)',
  start_date DATETIME NOT NULL COMMENT 'Ngày bắt đầu đấu giá',
  end_date DATETIME NOT NULL COMMENT 'Ngày kết thúc đấu giá',
  status ENUM('ACTIVE', 'ENDED', 'CANCELLED', 'PROCESSING') DEFAULT 'ACTIVE' COMMENT 'Trạng thái (HOẠT ĐỘNG, KẾT THÚC, HỦY, XỬ LÝ)',
  total_bids INT DEFAULT 0 COMMENT 'Tổng số lượt bid',
  min_bid_increment DECIMAL(10, 2) COMMENT 'Mức tăng giá tối thiểu (ví dụ 1.05 = tăng 5%)',
  is_automatic BOOLEAN DEFAULT FALSE COMMENT 'Cho phép đấu giá tự động',
  auto_bid_amount DECIMAL(15, 2) COMMENT 'Số tiền đấu giá tự động tối đa',
  winner_id INT COMMENT 'ID người chiến thắng (sau khi kết thúc)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Lần cập nhật cuối',
  ended_at TIMESTAMP NULL COMMENT 'Thời gian kết thúc',
  
  FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (highest_bidder_id) REFERENCES Users(id) ON DELETE SET NULL,
  FOREIGN KEY (winner_id) REFERENCES Users(id) ON DELETE SET NULL,
  INDEX idx_product_id (product_id),
  INDEX idx_seller_id (seller_id),
  INDEX idx_status (status),
  INDEX idx_end_date (end_date),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng đấu giá';

-- ============================================================================
-- Bảng Lượt Đấu Giá (Lịch sử nấu giá)
-- ============================================================================
CREATE TABLE IF NOT EXISTS Bids (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID lượt nấu giá',
  auction_id INT NOT NULL COMMENT 'ID đấu giá',
  bidder_id INT NOT NULL COMMENT 'ID người nấu giá',
  amount DECIMAL(15, 2) NOT NULL COMMENT 'Số tiền nấu giá',
  is_automatic BOOLEAN DEFAULT FALSE COMMENT 'Nấu giá tự động',
  bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian nấu giá',
  ip_address VARCHAR(45) COMMENT 'Địa chỉ IP (IPv4 hoặc IPv6)',
  
  FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (bidder_id) REFERENCES Users(id) ON DELETE CASCADE,
  INDEX idx_auction_id (auction_id),
  INDEX idx_bidder_id (bidder_id),
  INDEX idx_bid_time (bid_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lịch sử nấu giá';

-- ============================================================================
-- Bảng Thanh Toán
-- ============================================================================
CREATE TABLE IF NOT EXISTS Payments (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID thanh toán',
  auction_id INT COMMENT 'ID đấu giá (NULL nếu là nạp tiền)',
  user_id INT NOT NULL COMMENT 'ID người mua/người phải thanh toán',
  amount DECIMAL(15, 2) COMMENT 'Số tiền thanh toán',
  type ENUM('DEPOSIT', 'PAYMENT', 'WITHDRAWAL', 'REFUND') NOT NULL DEFAULT 'DEPOSIT' COMMENT 'Loại giao dịch',
  transaction_id VARCHAR(255) UNIQUE COMMENT 'Mã giao dịch từ gateway',
  status ENUM('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED') DEFAULT 'PENDING' COMMENT 'Trạng thái thanh toán',
  momo_order_id VARCHAR(255) COMMENT 'Order ID từ Momo',
  momo_request_id VARCHAR(255) COMMENT 'Request ID gửi tới Momo',
  error_message TEXT COMMENT 'Thông báo lỗi (nếu có)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Lần cập nhật cuối',
  paid_at TIMESTAMP NULL COMMENT 'Thời gian thanh toán thành công',
  
  FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_transaction_id (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng thanh toán';

-- Cập nhật các bản ghi thanh toán cũ để tương thích với cột `type` mới
-- Chạy lệnh này một lần sau khi thay đổi bảng
-- UPDATE Payments SET type = 'PAYMENT' WHERE auction_id IS NOT NULL;
-- UPDATE Payments SET type = 'DEPOSIT' WHERE auction_id IS NULL;


-- ============================================================================
-- Bảng Xếp Hạng & Bình Luận
-- ============================================================================
CREATE TABLE IF NOT EXISTS Reviews (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID bình luận',
  auction_id INT NOT NULL COMMENT 'ID đấu giá',
  reviewer_id INT NOT NULL COMMENT 'ID người viết bình luận',
  reviewee_id INT NOT NULL COMMENT 'ID người bị đánh giá',
  rating INT COMMENT 'Xếp hạng (1-5 sao)' CHECK (rating >= 1 AND rating <= 5),
  comment TEXT COMMENT 'Nội dung bình luận',
  is_positive BOOLEAN COMMENT 'Bình luận tích cực (TRUE) hay tiêu cực (FALSE)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  
  FOREIGN KEY (auction_id) REFERENCES Auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewee_id) REFERENCES Users(id) ON DELETE CASCADE,
  INDEX idx_reviewee_id (reviewee_id),
  INDEX idx_rating (rating),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng bình luận và xếp hạng';

-- ============================================================================
-- Bảng Tin Nhắn (Chat)
-- ============================================================================
CREATE TABLE IF NOT EXISTS Messages (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID tin nhắn',
  sender_id INT NOT NULL COMMENT 'ID người gửi',
  receiver_id INT NOT NULL COMMENT 'ID người nhận',
  content TEXT NOT NULL COMMENT 'Nội dung tin nhắn',
  is_read BOOLEAN DEFAULT FALSE COMMENT 'Đã đọc',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian gửi',
  
  FOREIGN KEY (sender_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES Users(id) ON DELETE CASCADE,
  INDEX idx_receiver_id (receiver_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng tin nhắn';

-- ============================================================================
-- Bảng Hoạt Động (Activity Log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS Activities (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID hoạt động',
  user_id INT COMMENT 'ID người dùng',
  action VARCHAR(100) NOT NULL COMMENT 'Hành động (VIEW, BID, PURCHASE, v.v.)',
  target_type VARCHAR(50) COMMENT 'Loại đối tượng (PRODUCT, AUCTION, USER)',
  target_id INT COMMENT 'ID đối tượng',
  description TEXT COMMENT 'Mô tả hoạt động',
  ip_address VARCHAR(45) COMMENT 'Địa chỉ IP',
  user_agent TEXT COMMENT 'User agent (trình duyệt)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian hoạt động',
  
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng ghi nhật ký hoạt động';

-- ============================================================================
-- Bảng Cấu Hình Hệ Thống
-- ============================================================================
CREATE TABLE IF NOT EXISTS SystemConfig (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID cấu hình',
  config_key VARCHAR(100) UNIQUE NOT NULL COMMENT 'Tên cấu hình',
  config_value TEXT COMMENT 'Giá trị cấu hình',
  config_type VARCHAR(50) COMMENT 'Loại (STRING, NUMBER, BOOLEAN, JSON)',
  description TEXT COMMENT 'Mô tả',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Lần cập nhật cuối'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng cấu hình hệ thống';

-- Thêm cấu hình mặc định
INSERT IGNORE INTO SystemConfig (config_key, config_value, config_type, description) VALUES
('min_bid_increment', '1.05', 'NUMBER', 'Mức tăng giá tối thiểu (nhân với giá hiện tại, ví dụ 1.05 = tăng 5%)'),
('default_auction_duration', '7', 'NUMBER', 'Thời gian đấu giá mặc định (ngày)'),
('max_file_upload_size', '5242880', 'NUMBER', 'Kích thước tệp tối đa (byte = 5MB)'),
('maintenance_mode', 'false', 'BOOLEAN', 'Chế độ bảo trì hệ thống'),
('email_notifications_enabled', 'true', 'BOOLEAN', 'Bật thông báo email');

-- ============================================================================
-- Triggers
-- ============================================================================

-- Cập nhật rating người bán dựa trên reviews
DROP TRIGGER IF EXISTS update_user_rating;
CREATE TRIGGER update_user_rating AFTER INSERT ON Reviews
FOR EACH ROW
UPDATE Users 
SET rating = (
  SELECT AVG(rating) FROM Reviews WHERE reviewee_id = NEW.reviewee_id
)
WHERE id = NEW.reviewee_id;

-- Cập nhật tổng số bids khi thêm bid mới
DROP TRIGGER IF EXISTS increment_bid_count;
CREATE TRIGGER increment_bid_count AFTER INSERT ON Bids
FOR EACH ROW
UPDATE Auctions 
SET total_bids = total_bids + 1,
    current_price = NEW.amount,
    highest_bidder_id = NEW.bidder_id
WHERE id = NEW.auction_id;

-- ============================================================================
-- Views
-- ============================================================================

-- View: Thông tin chi tiết đấu giá
CREATE OR REPLACE VIEW AuctionDetails AS
SELECT 
  a.id,
  a.product_id,
  p.name AS product_name,
  p.description,
  a.seller_id,
  u_seller.full_name AS seller_name,
  a.starting_price,
  a.current_price,
  a.highest_bidder_id,
  u_bidder.full_name AS highest_bidder_name,
  a.start_date,
  a.end_date,
  a.status,
  a.total_bids,
  TIMESTAMPDIFF(MINUTE, NOW(), a.end_date) AS remaining_minutes,
  IF(a.status = 'ACTIVE' AND NOW() < a.end_date, TRUE, FALSE) AS is_ongoing
FROM Auctions a
JOIN Products p ON a.product_id = p.id
JOIN Users u_seller ON a.seller_id = u_seller.id
LEFT JOIN Users u_bidder ON a.highest_bidder_id = u_bidder.id;

-- View: Người dùng với vai trò
CREATE OR REPLACE VIEW UserWithRoles AS
SELECT 
  u.id,
  u.email,
  u.full_name,
  GROUP_CONCAT(r.name SEPARATOR ', ') AS roles
FROM Users u
LEFT JOIN UserRoles ur ON u.id = ur.user_id
LEFT JOIN Roles r ON ur.role_id = r.id
GROUP BY u.id;

-- ============================================================================
-- Chỉ mục bổ sung để tối ưu hiệu suất
-- ============================================================================

ALTER TABLE Auctions ADD INDEX idx_status_end_date (status, end_date);
ALTER TABLE Bids ADD INDEX idx_auction_bid_time (auction_id, bid_time);
ALTER TABLE Products ADD INDEX idx_seller_active (seller_id, is_active);
ALTER TABLE Users ADD INDEX idx_rating_created (rating, created_at);

-- Tối ưu cho hàm findWonByUserId (Tìm người thắng cuộc)
ALTER TABLE Auctions ADD INDEX idx_winner_id (winner_id);
ALTER TABLE Auctions ADD INDEX idx_highest_bidder_id (highest_bidder_id);

-- Tối ưu cho hàm findSoldItemsBySeller (Tìm hàng đã bán của người bán)
ALTER TABLE Auctions ADD INDEX idx_seller_status (seller_id, status);

-- Tối ưu cho hàm payForWonAuction (Chống trừ tiền 2 lần cực nhanh)
ALTER TABLE Payments ADD INDEX idx_auction_user_status (auction_id, user_id, status);

-- ============================================================================
-- Hoàn thành
-- ============================================================================
-- Cấu trúc cơ sở dữ liệu đã được tạo thành công
-- Mô tả trang thái: ✅ Sẵn sàng để sử dụng
