const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { sql } = require('../config/database');
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

// Lấy danh sách sản phẩm CỦA RIÊNG người bán này
router.get('/products', verifyToken, async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('sellerId', sql.Int, req.userId)
            .query(`
                SELECT p.*, 
                (SELECT TOP 1 ImageUrl FROM ProductImages WHERE ProductId = p.Id ORDER BY Id ASC) as Thumbnail,
                (SELECT COUNT(*) FROM ProductImages WHERE ProductId = p.Id) as ImageCount,
                CASE WHEN EXISTS (SELECT 1 FROM Auctions a WITH (NOLOCK) WHERE a.ProductId = p.Id AND a.Status = 'Active' AND a.EndTime > GETDATE()) THEN 1 ELSE 0 END as IsAuctioned
                FROM Products p WITH (NOLOCK) WHERE SellerId = @sellerId ORDER BY Id DESC
            `);
        const products = result.recordset.map(p => ({
            ...p,
            image: p.Thumbnail
        }));
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Lấy danh sách đấu giá CỦA RIÊNG người bán này
router.get('/auctions', verifyToken, async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('sellerId', sql.Int, req.userId)
            .query(`
                SELECT a.Id, p.Name as productName, 
                (SELECT TOP 1 ImageUrl FROM ProductImages WHERE ProductId = p.Id ORDER BY Id ASC) as productThumbnail,
                a.StartingBid as startingPrice, 
                a.CurrentBid as currentBid, a.EndTime,
                       hb.Id as HighestBidderId, hb.Name as HighestBidderName, hb.Avatar as HighestBidderAvatar,
                (SELECT COUNT(*) FROM Bids WITH (NOLOCK) WHERE AuctionId = a.Id) as BidCount,
                a.Status -- FIX: Lấy trạng thái thực từ DB thay vì tính toán theo thời gian
                FROM Auctions a WITH (NOLOCK)
                JOIN Products p WITH (NOLOCK) ON a.ProductId = p.Id
                LEFT JOIN Users hb WITH (NOLOCK) ON a.HighestBidderId = hb.Id
                WHERE p.SellerId = @sellerId
                ORDER BY a.CreatedAt DESC
            `);

        const auctions = result.recordset.map(a => {
            let status = (a.Status || '').toLowerCase();
            // Nếu thời gian đã hết nhưng trạng thái vẫn là Active -> Đang chờ xử lý (Cron Job)
            if (status === 'active' && new Date(a.EndTime) <= new Date()) {
                status = 'processing';
            }
            
            return {
                id: a.Id,
                productName: a.productName,
                image: a.productThumbnail,
                startingPrice: Number(a.startingPrice),
                currentBid: Number(a.currentBid || 0),
                highestBidderId: a.HighestBidderId,
                highestBidderName: a.HighestBidderName,
                highestBidderAvatar: a.HighestBidderAvatar,
                bidCount: a.BidCount,
                endTime: a.EndTime,
                status: status
            };
        });
        res.json(auctions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Lấy danh sách sản phẩm ĐÃ BÁN THÀNH CÔNG (Đã kết thúc và có người thắng)
router.get('/sold-items', verifyToken, async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('sellerId', sql.Int, req.userId)
            .query(`
                SELECT a.Id as auctionId, a.Title as productName, a.CurrentBid as soldPrice, a.EndTime,
                       u.Id as BuyerId, u.Name as buyerName, u.Email as buyerEmail, u.Avatar as BuyerAvatar,
                       (SELECT TOP 1 ImageUrl FROM ProductImages WHERE ProductId = p.Id ORDER BY Id ASC) as thumbnail,
                       ISNULL(pay.Status, 'Pending') as paymentStatus
                FROM Auctions a WITH (NOLOCK)
                JOIN Products p WITH (NOLOCK) ON a.ProductId = p.Id
                LEFT JOIN Users u WITH (NOLOCK) ON a.HighestBidderId = u.Id
                LEFT JOIN Payments pay WITH (NOLOCK) ON pay.AuctionId = a.Id
                WHERE p.SellerId = @sellerId 
                  AND a.EndTime < GETDATE() 
                  AND a.HighestBidderId IS NOT NULL
                ORDER BY a.EndTime DESC
            `);
        const items = result.recordset.map(item => ({
            ...item,
            buyerId: item.BuyerId,
            buyerAvatar: item.BuyerAvatar,
            image: item.thumbnail
        }));
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Kết thúc phiên đấu giá thủ công (Sớm hơn dự kiến)
router.post('/auctions/:id/end', verifyToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        const pool = await sql.connect();
        
        // Kiểm tra quyền sở hữu và trạng thái
        // FIX: Cho phép tìm thấy phiên đấu giá ngay cả khi Status bị NULL (lỗi dữ liệu cũ)
        // Chỉ cần đúng ID và đúng SellerId
        const check = await pool.request()
            .input('id', sql.Int, id)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.Id, a.Status FROM Auctions a 
                JOIN Products p ON a.ProductId = p.Id 
                WHERE a.Id = @id AND p.SellerId = @userId
            `);

        if (check.recordset.length === 0) {
            return res.status(403).json({ message: 'Không tìm thấy phiên đấu giá hoặc bạn không có quyền.' });
        }

        const auction = check.recordset[0];
        
        // FIX: Nếu đã kết thúc thành công, trả về 200 để Client refresh lại giao diện (Idempotent)
        if (auction.Status === 'Ended') {
            return res.json({ message: 'Phiên đấu giá đã kết thúc.' });
        }
        
        // Lưu ý: Nếu Status là 'PaymentFailed', code sẽ chạy tiếp xuống dưới để reset về 'Active'
        // Điều này hoạt động như tính năng "Thử lại thanh toán" (Retry Payment).

        // Cập nhật EndTime về hiện tại để kết thúc ngay lập tức
        // QUAN TRỌNG: Force Status = 'Active' để đảm bảo Cron Job (server.js) quét thấy và xử lý thanh toán.
        // (Trường hợp Status đang NULL, lệnh này sẽ sửa nó thành Active để Cron chạy được)
        // FIX: Trừ 1 giây để đảm bảo EndTime < Hiện tại ngay lập tức (tránh lỗi so sánh mili-giây giữa Node và SQL)
        await pool.request()
            .input('id', sql.Int, id)
            .query("UPDATE Auctions SET EndTime = DATEADD(second, -1, GETDATE()), Status = 'Active' WHERE Id = @id");

        res.json({ message: 'Đã yêu cầu kết thúc. Hệ thống đang xử lý thanh toán...' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- CÁC CHỨC NĂNG BỔ SUNG ---

// 1. Lấy thống kê tổng quan cho Seller (Dashboard)
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('sellerId', sql.Int, req.userId)
            .query(`
                SELECT 
                    (SELECT COUNT(*) FROM Products WHERE SellerId = @sellerId) as TotalProducts,
                    (SELECT COUNT(*) FROM Auctions a JOIN Products p ON a.ProductId = p.Id WHERE p.SellerId = @sellerId AND a.Status = 'Active' AND a.EndTime > GETDATE()) as ActiveAuctions,
                    (SELECT COUNT(*) FROM Auctions a JOIN Products p ON a.ProductId = p.Id WHERE p.SellerId = @sellerId AND a.HighestBidderId IS NOT NULL AND a.EndTime < GETDATE()) as SoldItems,
                    (SELECT ISNULL(SUM(a.CurrentBid), 0) FROM Auctions a JOIN Products p ON a.ProductId = p.Id WHERE p.SellerId = @sellerId AND a.HighestBidderId IS NOT NULL AND a.EndTime < GETDATE()) as TotalRevenue
            `);
        
        res.json(result.recordset[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. Hủy/Xóa phiên đấu giá (Chỉ được xóa khi CHƯA có ai đặt giá)
router.delete('/auctions/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        const pool = await sql.connect();
        
        // Kiểm tra điều kiện: Phải là chủ sở hữu VÀ chưa có ai đặt giá (HighestBidderId IS NULL)
        const check = await pool.request()
            .input('id', sql.Int, id)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT a.Id, a.HighestBidderId 
                FROM Auctions a 
                JOIN Products p ON a.ProductId = p.Id 
                WHERE a.Id = @id AND p.SellerId = @userId
            `);

        if (check.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy phiên đấu giá hoặc bạn không có quyền.' });
        }

        if (check.recordset[0].HighestBidderId !== null) {
            return res.status(400).json({ message: 'Không thể xóa phiên đấu giá đã có người tham gia.' });
        }

        // Thực hiện xóa
        await pool.request().input('id', sql.Int, id).query('DELETE FROM Auctions WHERE Id = @id');

        res.json({ message: 'Đã xóa phiên đấu giá thành công.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 3. Đăng lại (Relist) phiên đấu giá đã kết thúc mà không có người mua
router.post('/auctions/:id/relist', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { endTime } = req.body; // Thời gian kết thúc mới
    const userId = req.userId;

    if (!endTime || new Date(endTime) <= new Date()) {
        return res.status(400).json({ message: 'Thời gian kết thúc mới phải hợp lệ.' });
    }

    try {
        const pool = await sql.connect();
        
        // Chỉ cho phép relist nếu phiên đã kết thúc (hoặc bị hủy) VÀ chưa có người thắng
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('userId', sql.Int, userId)
            .input('endTime', sql.DateTime2, endTime)
            .query(`
                UPDATE Auctions 
                SET EndTime = @endTime, Status = 'Active', CreatedAt = GETDATE()
                WHERE Id = @id 
                  AND Id IN (SELECT a.Id FROM Auctions a JOIN Products p ON a.ProductId = p.Id WHERE p.SellerId = @userId)
                  AND (HighestBidderId IS NULL)
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(400).json({ message: 'Không thể đăng lại. Có thể phiên này đã có người thắng hoặc không thuộc về bạn.' });
        }

        res.json({ message: 'Đã đăng lại phiên đấu giá thành công.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Lấy lịch sử đấu giá của một phiên đấu giá (dành cho Seller)
router.get('/auctions/:id/bids', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();
        // Kiểm tra xem phiên đấu giá này có thuộc về người bán này không
        const check = await pool.request()
            .input('auctionId', sql.Int, id)
            .input('userId', sql.Int, req.userId)
            .query(`
                SELECT a.Id FROM Auctions a JOIN Products p ON a.ProductId = p.Id WHERE a.Id = @auctionId AND p.SellerId = @userId
            `);
        if (check.recordset.length === 0) {
            console.error(`❌ [API] GET /api/seller/auctions/${id}/bids - Unauthorized or Not Found for User ${req.userId}`);
            return res.status(403).json({ message: 'Bạn không có quyền xem lịch sử đấu giá này' });
        }
        const result = await pool.request()
            .input('auctionId', sql.Int, id)
            .query(`
                SELECT b.BidAmount, b.BidTime, u.Name, u.Avatar FROM Bids b JOIN Users u ON b.UserId = u.Id WHERE b.AuctionId = @auctionId ORDER BY b.BidTime DESC
            `);
        const bids = result.recordset.map(b => ({
            bidAmount: b.BidAmount,
            bidTime: b.BidTime,
            bidderName: b.Name,
            bidderAvatar: b.Avatar,
            formattedAmount: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(b.BidAmount)
        }));
        res.json(bids);
    } catch (error) {
        console.error(`❌ [API] GET /api/seller/auctions/${id}/bids Error:`, error);
        res.status(500).json({ message: error.message });
    }
});

// --- QUẢN LÝ HỒ SƠ SELLER (Tương tự User) ---

// Lấy thông tin hồ sơ
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
        console.error('GET /api/seller/profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cập nhật hồ sơ
router.put('/profile', verifyToken, upload.single('avatar'), async (req, res) => {
    const userId = req.userId;
    const { name, email, password } = req.body;
    let avatarUrl = req.body.avatar;

    if (req.file) {
        avatarUrl = `/uploads/avatars/${req.file.filename}`;
    }

    try {
        const pool = await sql.connect();
        
        let updateFields = [];
        const request = pool.request().input('userId', sql.Int, userId);

        if (name) { updateFields.push('Name = @name'); request.input('name', sql.NVarChar, name); }
        if (email) { updateFields.push('Email = @email'); request.input('email', sql.NVarChar, email); }
        if (avatarUrl) { updateFields.push('Avatar = @avatar'); request.input('avatar', sql.NVarChar, avatarUrl); }
        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push('Password = @password');
            request.input('password', sql.VarChar, hashedPassword);
        }

        if (updateFields.length === 0) return res.json({ message: 'Không có thông tin nào thay đổi' });
        
        await request.query(`UPDATE Users SET ${updateFields.join(', ')} WHERE Id = @userId`);
        res.json({ message: 'Cập nhật hồ sơ thành công', avatar: avatarUrl });
    } catch (error) {
        console.error('PUT /api/seller/profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;