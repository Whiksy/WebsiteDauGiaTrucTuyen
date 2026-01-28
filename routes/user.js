const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sql } = require('../config/database');
const bcrypt = require('bcryptjs');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// --- Cấu hình Multer cho Upload Avatar ---
let upload;
try {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(__dirname, '../uploads/avatars');
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
        }
    });
    upload = multer({ storage: storage });
} catch (e) {
    console.warn('⚠️ Module "multer" chưa được cài đặt. Upload ảnh sẽ không hoạt động.');
    upload = { single: () => (req, res, next) => next() };
}

const maskName = (name) => {
    if (!name) return '***';
    const parts = name.trim().split(' ');
    if (parts.length <= 1) return name.substring(0, 2) + '***';
    return parts[0] + ' *** ' + parts[parts.length - 1].substring(0, 1);
};

// Get user bids history
router.get('/bids', verifyToken, async (req, res) => {
  const userId = req.userId;

  try {
    const pool = await sql.connect();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT b.Id, b.BidAmount as amount, b.BidTime as timestamp,
               ISNULL(p.Name, a.Title) as productName,
               (SELECT TOP 1 ImageUrl FROM ProductImages WHERE ProductId = p.Id ORDER BY Id ASC) as Thumbnail,
               CASE WHEN a.EndTime > GETDATE() THEN 'active' ELSE CASE WHEN a.HighestBidderId = @userId THEN 'won' ELSE 'lost' END END as status
        FROM Bids b
        JOIN Auctions a ON b.AuctionId = a.Id
        JOIN Products p ON a.ProductId = p.Id
        WHERE b.UserId = @userId
        ORDER BY b.BidTime DESC
      `);

    const bids = result.recordset.map(bid => ({
      id: bid.Id,
      productName: bid.productName,
      image: bid.Thumbnail,
      amount: Number(bid.amount),
      timestamp: bid.timestamp,
      status: bid.status
    }));

    res.json(bids);
  } catch (error) {
    console.error(`❌ [API] GET /api/user/bids Error for UserID ${userId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Lấy danh sách các phiên đang tham gia (Đang đấu giá, chưa kết thúc)
router.get('/participating', verifyToken, async (req, res) => {
    const userId = req.userId;
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.Id, ISNULL(p.Name, a.Title) as productName, a.StartingBid, a.CurrentBid, a.EndTime, a.HighestBidderId, p.SellerId,
                       (SELECT TOP 1 ImageUrl FROM ProductImages WHERE ProductId = p.Id ORDER BY Id ASC) as Thumbnail,
                       hb.Name as HighestBidderName, hb.Avatar as HighestBidderAvatar,
                       s.Name as SellerName, s.Avatar as SellerAvatar,
                       (SELECT COUNT(*) FROM Bids WHERE AuctionId = a.Id) as BidCount
                FROM Auctions a
                JOIN Products p ON a.ProductId = p.Id
                LEFT JOIN Users s ON p.SellerId = s.Id
                LEFT JOIN Users hb ON a.HighestBidderId = hb.Id
                WHERE a.Id IN (SELECT DISTINCT AuctionId FROM Bids WHERE UserId = @userId)
                AND a.EndTime > GETDATE()
                ORDER BY a.EndTime ASC
            `);
        
        const auctions = result.recordset.map(a => ({
            id: a.Id,
            productName: a.productName,
            image: a.Thumbnail || '', // Trả về chuỗi rỗng thay vì null để tránh lỗi frontend
            sellerName: a.SellerName || 'Unknown',
            sellerId: a.SellerId,
            sellerAvatar: a.SellerAvatar,
            startingPrice: Number(a.StartingBid),
            currentBid: Number(a.CurrentBid),
            endTime: a.EndTime,
            isWinning: a.HighestBidderId === userId,
            highestBidderId: a.HighestBidderId,
            topBidder: maskName(a.HighestBidderName),
            topBidderAvatar: a.HighestBidderAvatar,
            bidCount: a.BidCount,
            status: 'active'
        }));
        res.json(auctions);
    } catch (error) {
        console.error('❌ [API] GET /api/user/participating Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Lấy danh sách sản phẩm ĐÃ THẮNG (Cần thanh toán hoặc đã thanh toán)
router.get('/won-auctions', verifyToken, async (req, res) => {
  const userId = req.userId;
  try {
    const pool = await sql.connect();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT a.Id as auctionId, ISNULL(p.Name, a.Title) as productName, a.CurrentBid as winningPrice, a.EndTime,
               s.Id as SellerId, s.Name as SellerName, s.Avatar as SellerAvatar,
               (SELECT TOP 1 ImageUrl FROM ProductImages WHERE ProductId = p.Id ORDER BY Id ASC) as Thumbnail,
               ISNULL(pay.Status, 'Pending') as paymentStatus
        FROM Auctions a
        JOIN Products p ON a.ProductId = p.Id
        LEFT JOIN Users s ON p.SellerId = s.Id
        LEFT JOIN Payments pay ON pay.AuctionId = a.Id
        WHERE a.HighestBidderId = @userId 
          AND a.EndTime < GETDATE()
        ORDER BY a.EndTime DESC
      `);

    const auctions = result.recordset.map(a => ({
        auctionId: a.auctionId,
        productName: a.productName,
        winningPrice: a.winningPrice,
        endTime: a.EndTime,
        image: a.Thumbnail,
        sellerId: a.SellerId,
        sellerName: a.SellerName,
        sellerAvatar: a.SellerAvatar,
        paymentStatus: a.paymentStatus
    }));
    res.json(auctions);
  } catch (error) {
    console.error('❌ [API] GET /api/user/won-auctions Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  const userId = req.userId;

  try {
    const pool = await sql.connect();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT Id, Email, Name, Avatar FROM Users WHERE Id = @userId');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.recordset[0];
    res.json({ id: user.Id, email: user.Email, name: user.Name, avatar: user.Avatar });
  } catch (error) {
    console.error('GET /api/user/profile error:', error && (error.stack || error));
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/profile', verifyToken, upload.single('avatar'), async (req, res) => {
  const userId = req.userId;
  const { name, email, password } = req.body;
  let avatarUrl = req.body.avatar; // Nếu gửi URL (string)

  // Nếu có file upload, dùng đường dẫn file
  if (req.file) {
      avatarUrl = `/uploads/avatars/${req.file.filename}`;
  }

  try {
    const pool = await sql.connect();
    
    // Xây dựng câu lệnh SQL động dựa trên các trường được gửi lên
    let updateFields = [];
    const request = pool.request().input('userId', sql.Int, userId);

    if (name) {
        updateFields.push('Name = @name');
        request.input('name', sql.NVarChar, name);
    }
    if (email) {
        updateFields.push('Email = @email');
        request.input('email', sql.NVarChar, email);
    }
    if (avatarUrl) {
        updateFields.push('Avatar = @avatar');
        request.input('avatar', sql.NVarChar, avatarUrl);
    }
    if (password && password.trim() !== '') {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.push('Password = @password');
        request.input('password', sql.VarChar, hashedPassword);
    }

    if (updateFields.length === 0) {
        return res.json({ message: 'Không có thông tin nào thay đổi' });
    }
    
    const query = `UPDATE Users SET ${updateFields.join(', ')} WHERE Id = @userId`;
    await request.query(query);

    res.json({ message: 'Cập nhật hồ sơ thành công', avatar: avatarUrl });
  } catch (error) {
    console.error('PUT /api/user/profile error:', error && (error.stack || error));
    res.status(500).json({ error: error.message });
  }
});

// Lấy thông tin công khai của một User bất kỳ (Để xem hồ sơ người bán/người thắng)
router.get('/public/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT Id, Name, Avatar, CreatedAt FROM Users WHERE Id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result.recordset[0];
        res.json({ id: user.Id, name: user.Name, avatar: user.Avatar, joinedAt: user.CreatedAt });
    } catch (error) {
        console.error('GET /api/user/public/:id error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;