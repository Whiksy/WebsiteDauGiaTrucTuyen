const express = require('express');
const { sql } = require('../config/database');
const { verifyToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Middleware: Chỉ Admin mới được truy cập tất cả các route trong file này
router.use(verifyToken, authorizeRole(['Admin']));

// 1. Dashboard Stats & Charts
router.get('/stats', async (req, res) => {
    try {
        const pool = await sql.connect();
        
        // Thống kê tổng quan
        const counts = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM Users) as totalUsers,
                (SELECT COUNT(*) FROM Products) as totalProducts,
                (SELECT COUNT(*) FROM Auctions WHERE Status = 'Active' AND EndTime > GETDATE()) as activeAuctions,
                (SELECT ISNULL(SUM(Amount), 0) FROM Payments WHERE Status = 'Paid') as totalRevenue
        `);

        // Dữ liệu biểu đồ doanh thu (6 tháng gần nhất)
        const revenueChart = await pool.request().query(`
            SELECT FORMAT(CreatedAt, 'MM/yyyy') as Month, SUM(Amount) as Revenue
            FROM Payments 
            WHERE Status = 'Paid' AND CreatedAt >= DATEADD(MONTH, -6, GETDATE())
            GROUP BY FORMAT(CreatedAt, 'MM/yyyy')
            ORDER BY MIN(CreatedAt)
        `);

        // Dữ liệu biểu đồ trạng thái đấu giá
        const statusChart = await pool.request().query(`
            SELECT Status, COUNT(*) as Count FROM Auctions GROUP BY Status
        `);

        // Hoạt động gần đây (Gộp từ User mới và Đấu giá mới)
        const activity = await pool.request().query(`
            SELECT TOP 5 * FROM (
                SELECT 'New User' as Type, Name as Description, CreatedAt FROM Users
                UNION ALL
                SELECT 'New Auction' as Type, Title as Description, CreatedAt FROM Auctions
            ) as Combined
            ORDER BY CreatedAt DESC
        `);

        // Đấu giá vừa kết thúc
        const recentEnded = await pool.request().query(`
            SELECT TOP 5 a.Id, a.Title, a.CurrentBid, u.Name as Winner
            FROM Auctions a
            LEFT JOIN Users u ON a.HighestBidderId = u.Id
            WHERE a.EndTime < GETDATE()
            ORDER BY a.EndTime DESC
        `);

        res.json({
            counts: counts.recordset[0],
            revenueChart: revenueChart.recordset,
            statusChart: statusChart.recordset,
            activity: activity.recordset,
            recentEnded: recentEnded.recordset
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Quản lý Users
router.get('/users', async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request().query(`
            SELECT u.Id, u.Name, u.Email, u.Avatar, u.CreatedAt,
                   STUFF((
                        SELECT ', ' + r.Name
                        FROM UserRoles ur
                        JOIN Roles r ON ur.RoleId = r.Id
                        WHERE ur.UserId = u.Id
                        FOR XML PATH('')
                   ), 1, 2, '') as Role
            FROM Users u
            ORDER BY u.Id DESC
        `);
        
        const users = result.recordset.map(u => ({
            id: u.Id,
            name: u.Name,
            email: u.Email,
            role: u.Role || 'User',
            avatar: u.Avatar,
            joinedAt: u.CreatedAt
        }));
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cập nhật User (Role)
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body; // 'User', 'Seller', 'Admin'
    
    try {
        const pool = await sql.connect();
        
        // Lấy RoleId
        const roleRes = await pool.request().input('name', sql.NVarChar, role).query("SELECT Id FROM Roles WHERE Name = @name");
        if(roleRes.recordset.length === 0) return res.status(400).json({message: 'Role không hợp lệ'});
        const roleId = roleRes.recordset[0].Id;

        // Xóa role cũ và thêm role mới (đơn giản hóa: mỗi user 1 role chính)
        await pool.request().input('uid', sql.Int, id).query("DELETE FROM UserRoles WHERE UserId = @uid");
        await pool.request().input('uid', sql.Int, id).input('rid', sql.Int, roleId).query("INSERT INTO UserRoles (UserId, RoleId) VALUES (@uid, @rid)");

        res.json({ message: 'Cập nhật người dùng thành công' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();
        // Xóa ràng buộc trước (UserRoles, Bids, Products...) - Trong thực tế nên dùng Soft Delete (IsDeleted)
        // Ở đây demo xóa cứng, cần xóa bảng phụ trước
        await pool.request().input('id', sql.Int, id).query(`
            DELETE FROM UserRoles WHERE UserId = @id;
            DELETE FROM Bids WHERE UserId = @id;
            DELETE FROM Payments WHERE UserId = @id;
            UPDATE Products SET SellerId = NULL WHERE SellerId = @id;
            UPDATE Auctions SET HighestBidderId = NULL WHERE HighestBidderId = @id;
            DELETE FROM Users WHERE Id = @id;
        `);
        res.json({ message: 'Đã xóa người dùng' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Quản lý Products
router.get('/products', async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request().query(`
            SELECT p.Id, p.Name, p.Price, p.Stock, u.Name as SellerName,
            (SELECT TOP 1 ImageUrl FROM ProductImages WHERE ProductId = p.Id) as Thumbnail
            FROM Products p
            LEFT JOIN Users u ON p.SellerId = u.Id
            ORDER BY p.Id DESC
        `);
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lấy chi tiết sản phẩm (Cho Admin)
router.get('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();
        const result = await pool.request().input('id', sql.Int, id).query(`
            SELECT p.*, u.Name as SellerName
            FROM Products p LEFT JOIN Users u ON p.SellerId = u.Id
            WHERE p.Id = @id
        `);
        if (result.recordset.length === 0) return res.status(404).json({ message: 'Not found' });
        
        const product = result.recordset[0];
        const imagesRes = await pool.request().input('pid', sql.Int, id).query('SELECT ImageUrl FROM ProductImages WHERE ProductId = @pid');
        product.images = imagesRes.recordset.map(i => i.ImageUrl);
        
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Quản lý Auctions
router.get('/auctions', async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request().query(`
            SELECT a.Id, a.Title as productName, a.CurrentBid, a.EndTime, a.Status,
                   u.Name as SellerName,
                   (SELECT COUNT(*) FROM Bids WHERE AuctionId = a.Id) as BidCount
            FROM Auctions a
            JOIN Products p ON a.ProductId = p.Id
            LEFT JOIN Users u ON p.SellerId = u.Id
            ORDER BY a.EndTime DESC
        `);
        
        const auctions = result.recordset.map(a => ({
            id: a.Id,
            productName: a.productName,
            currentBid: a.CurrentBid,
            endTime: a.EndTime,
            status: (new Date(a.EndTime) > new Date() && a.Status === 'Active') ? 'active' : 'ended',
            sellerName: a.SellerName,
            bidCount: a.BidCount
        }));
        res.json(auctions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Kết thúc đấu giá (Admin Force End)
router.post('/auctions/:id/end', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();
        await pool.request().input('id', sql.Int, id).query("UPDATE Auctions SET EndTime = GETDATE(), Status = 'Ended' WHERE Id = @id");
        res.json({ message: 'Đã kết thúc phiên đấu giá' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lấy chi tiết 1 Auction cho Admin xem
router.get('/auctions/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`🔍 [Admin] GET /auctions/${id} - Requesting details`);
    try {
        const pool = await sql.connect();
        
        // Debug: Kiểm tra xem ID có tồn tại trong bảng Auctions không (để loại trừ lỗi do JOIN)
        const check = await pool.request().input('id', sql.Int, id).query('SELECT Id FROM Auctions WHERE Id = @id');
        if (check.recordset.length === 0) {
             console.log(`⚠️ [Admin] Auction ${id} not found in Auctions table`);
             return res.status(404).json({message: 'Auction not found in DB'});
        }

        const result = await pool.request().input('id', sql.Int, id).query(`
            SELECT a.*, p.Name as ProductName, u.Name as SellerName, hb.Name as WinnerName
            FROM Auctions a
            JOIN Products p ON a.ProductId = p.Id
            LEFT JOIN Users u ON p.SellerId = u.Id
            LEFT JOIN Users hb ON a.HighestBidderId = hb.Id
            WHERE a.Id = @id
        `);
        
        if(result.recordset.length === 0) {
            console.log(`⚠️ [Admin] Auction ${id} found in DB but query returned 0 rows (Possible missing Product link)`);
            return res.status(404).json({message: 'Auction details not found (Product missing?)'});
        }
        
        // Lấy bids
        const bids = await pool.request().input('id', sql.Int, id).query(`
            SELECT b.BidAmount, b.BidTime, u.Name FROM Bids b JOIN Users u ON b.UserId = u.Id WHERE b.AuctionId = @id ORDER BY b.BidAmount DESC
        `);
        
        console.log(`✅ [Admin] Auction ${id} details loaded successfully`);
        res.json({ info: result.recordset[0], bids: bids.recordset });
    } catch (error) {
        console.error(`❌ [Admin] GET /auctions/${id} Error:`, error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;