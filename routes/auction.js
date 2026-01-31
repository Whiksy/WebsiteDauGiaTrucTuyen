const express = require('express');
const { sql } = require('../config/database');
const { client } = require('../config/redis');
const { verifyToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// --- HELPER FUNCTIONS ---
const formatVND = (amount) => {
    try {
        if (amount === null || amount === undefined) return '0 ₫';
        return Number(amount).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    } catch (e) {
        return `${amount} VND`;
    }
};

const maskName = (name) => {
    if (!name) return '***';
    const parts = name.trim().split(' ');
    if (parts.length <= 1) return name.substring(0, 2) + '***';
    return parts[0] + ' *** ' + parts[parts.length - 1].substring(0, 1);
};

const inMemoryCache = new Map();
const locks = new Map();
const redisAvailable = () => client && client.isOpen;

const redisGet = async (key) => {
    if (redisAvailable()) return await client.get(key);
    return inMemoryCache.get(key) || null;
};

const redisSetEx = async (key, ttl, value) => {
    if (redisAvailable()) return await client.setEx(key, ttl, value);
    inMemoryCache.set(key, value);
    setTimeout(() => inMemoryCache.delete(key), ttl * 1000);
    return 'OK';
};

const redisSetLock = async (key) => {
    if (redisAvailable()) return await client.set(key, 'locked', { EX: 10, NX: true });
    if (!locks.has(key)) {
        locks.set(key, Date.now() + 10000);
        setTimeout(() => locks.delete(key), 10000);
        return 'locked';
    }
    return null;
};

const redisDel = async (key) => {
    if (redisAvailable()) return await client.del(key);
    locks.delete(key);
    inMemoryCache.delete(key);
    return 1;
};


// --- ROUTES ---

// 1. Lấy danh sách đấu giá công khai (Trang chủ)
router.get('/', async (req, res) => {
    const { q, min, max, status } = req.query;
    try {
        const pool = await sql.connect();
        let query = `
            SELECT a.Id, a.Title, a.StartingBid, a.CurrentBid, a.EndTime, a.Status, a.HighestBidderId, p.SellerId, p.Name as ProductName,
            (SELECT TOP 1 ImageUrl FROM ProductImages WHERE ProductId = p.Id ORDER BY Id ASC) as ProductThumbnail,
            (SELECT COUNT(*) FROM Bids WHERE AuctionId = a.Id) as BidCount,
            u.Name as SellerName, u.Avatar as SellerAvatar,
            hb.Name as HighestBidderName, hb.Avatar as HighestBidderAvatar
            FROM Auctions a WITH (NOLOCK)
            JOIN Products p WITH (NOLOCK) ON a.ProductId = p.Id 
            LEFT JOIN Users u WITH (NOLOCK) ON p.SellerId = u.Id
            LEFT JOIN Users hb WITH (NOLOCK) ON a.HighestBidderId = hb.Id
            WHERE 1=1
        `;
        
        const request = pool.request();

        if (q) {
            query += ` AND (a.Title LIKE @q OR p.Name LIKE @q)`;
            request.input('q', sql.NVarChar, `%${q}%`);
        }
        if (min) {
            query += ` AND ISNULL(a.CurrentBid, a.StartingBid) >= @min`;
            request.input('min', sql.Decimal(18, 2), min);
        }
        if (max) {
            query += ` AND ISNULL(a.CurrentBid, a.StartingBid) <= @max`;
            request.input('max', sql.Decimal(18, 2), max);
        }
        
        if (status === 'all') {
            // Hiển thị tất cả (không lọc thời gian)
        } else if (status === 'ended') {
            query += ` AND a.EndTime <= GETDATE()`;
        } else {
            // FIX: Hiển thị tất cả Active, bao gồm cả những phiên vừa hết giờ đang chờ Cron xử lý (Processing)
            // Để người dùng không bị hoang mang khi vật phẩm "biến mất"
            query += ` AND a.Status = 'Active'`;
        }

        query += ` ORDER BY CASE WHEN a.EndTime > GETDATE() THEN 0 ELSE 1 END, a.EndTime ASC`;

        const result = await request.query(query);
        const auctions = result.recordset.map(auction => ({
            id: auction.Id,
            productName: auction.ProductName || auction.Title,
            image: auction.ProductThumbnail || '', // Tránh null để frontend không gọi placeholder lỗi
            sellerName: auction.SellerName || 'Unknown',
            sellerId: auction.SellerId,
            sellerAvatar: auction.SellerAvatar,
            topBidder: maskName(auction.HighestBidderName),
            highestBidderId: auction.HighestBidderId,
            topBidderAvatar: auction.HighestBidderAvatar,
            startingPrice: Number(auction.StartingBid),
            currentBid: Number(auction.CurrentBid || 0),
            bidCount: auction.BidCount,
            endTime: auction.EndTime,
            // FIX: Tính toán trạng thái chính xác hơn
            status: (() => {
                const isExpired = new Date(auction.EndTime) <= new Date();
                if (auction.Status === 'Active') {
                    return isExpired ? 'processing' : 'active';
                }
                return (auction.Status || '').toLowerCase();
            })()
        }));
        res.setHeader('Cache-Control', 'no-store'); // Đảm bảo dữ liệu luôn mới
        res.json(auctions);
    } catch (error) {
        console.error('❌ [API] GET /api/auction Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Lấy danh sách đấu giá của RIÊNG Seller
router.get('/seller/auctions', verifyToken, async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('userId', sql.Int, req.userId)
            .query(`
                SELECT a.Id, p.Name as productName, 
                       (SELECT TOP 1 ImageUrl FROM ProductImages WHERE ProductId = p.Id ORDER BY Id ASC) as productThumbnail,
                       a.StartingBid as startingPrice, 
                       a.CurrentBid as currentBid, a.EndTime as endTime, a.Status
                FROM Auctions a WITH (NOLOCK)
                JOIN Products p WITH (NOLOCK) ON a.ProductId = p.Id
                WHERE p.SellerId = @userId
                ORDER BY a.CreatedAt DESC
            `);
        
        const auctions = result.recordset.map(auction => ({
            id: auction.Id,
            productName: auction.productName,
            image: auction.productThumbnail,
            startingPrice: Number(auction.startingPrice),
            currentBid: Number(auction.currentBid || 0),
            endTime: auction.endTime,
            status: (auction.Status || '').toLowerCase()
        }));
        res.json(auctions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2.1 Lấy lịch sử đấu giá của một phiên (Công khai)
router.get('/:id/bids', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT b.BidAmount, b.BidTime, u.Name, u.Avatar
                FROM Bids b WITH (NOLOCK)
                JOIN Users u WITH (NOLOCK) ON b.UserId = u.Id
                WHERE b.AuctionId = @id
                ORDER BY b.BidAmount DESC
            `);
        
        const bids = result.recordset.map(b => ({
            amount: b.BidAmount,
            time: b.BidTime,
            bidderName: maskName(b.Name),
            bidderAvatar: b.Avatar,
            formattedAmount: formatVND(b.BidAmount)
        }));
        res.json(bids);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Lấy chi tiết một phiên đấu giá (Có Cache)
router.get('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const cached = await redisGet(`auction:${id}`);
        if (cached) {
            const obj = JSON.parse(cached);
            obj.currentBidVND = formatVND(obj.currentBid);
            return res.json(obj);
        }

        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT a.*, p.Name as ProductName, p.Description, p.SellerId,
                u.Name as SellerName, u.Avatar as SellerAvatar,
            hb.Name as HighestBidderName, hb.Avatar as HighestBidderAvatar,
                (SELECT COUNT(*) FROM Bids WITH (NOLOCK) WHERE AuctionId = a.Id) as BidCount
                FROM Auctions a WITH (NOLOCK)
                LEFT JOIN Products p WITH (NOLOCK) ON a.ProductId = p.Id 
                LEFT JOIN Users u WITH (NOLOCK) ON p.SellerId = u.Id
                LEFT JOIN Users hb WITH (NOLOCK) ON a.HighestBidderId = hb.Id
                WHERE a.Id = @id
            `);

        if (result.recordset.length === 0) return res.status(404).json({ message: 'Auction not found' });

        const auction = result.recordset[0];
        
        // Lấy danh sách ảnh
        const imagesRes = await pool.request().input('pid', sql.Int, auction.ProductId).query('SELECT ImageUrl FROM ProductImages WITH (NOLOCK) WHERE ProductId = @pid ORDER BY Id ASC');
        const images = imagesRes.recordset.map(i => i.ImageUrl);

        const response = {
            id: auction.Id,
            productId: auction.ProductId,
            title: auction.Title,
            productName: auction.ProductName,
            description: auction.Description,
            sellerId: auction.SellerId,
            sellerName: auction.SellerName,
            sellerAvatar: auction.SellerAvatar,
            startingPrice: Number(auction.StartingBid),
            currentBid: Number(auction.CurrentBid),
            bidCount: auction.BidCount,
            endTime: auction.EndTime,
            status: auction.Status,
            images: images,
            highestBidderId: auction.HighestBidderId,
            highestBidderName: maskName(auction.HighestBidderName),
            highestBidderAvatar: auction.HighestBidderAvatar
        };

        await redisSetEx(`auction:${id}`, 600, JSON.stringify(response));
        response.currentBidVND = formatVND(response.currentBid);
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Tạo phiên đấu giá mới (Dành cho Seller)
router.post('/', verifyToken, authorizeRole(['Seller', 'Admin']), async (req, res) => {
    const { productId, startingPrice, endTime } = req.body;
    try {
        const pool = await sql.connect();
        // Kiểm tra quyền sở hữu sản phẩm (Đã fix SellerId)
        const productCheck = await pool.request()
            .input('pid', sql.Int, productId)
            .input('sid', sql.Int, req.userId)
            .query('SELECT Name FROM Products WHERE Id = @pid AND SellerId = @sid');

        if (productCheck.recordset.length === 0) {
            return res.status(403).json({ message: 'Sản phẩm không thuộc quyền sở hữu của bạn' });
        }

        // Kiểm tra xem sản phẩm đã có trong phiên đấu giá nào đang diễn ra chưa
        const activeAuctionCheck = await pool.request()
            .input('pid', sql.Int, productId)
            .query("SELECT Id FROM Auctions WHERE ProductId = @pid AND Status = 'Active' AND EndTime > GETDATE()");
        
        if (activeAuctionCheck.recordset.length > 0) {
            return res.status(400).json({ message: 'Sản phẩm này đang trong một phiên đấu giá khác' });
        }

        if (new Date(endTime) <= new Date()) {
             return res.status(400).json({ message: 'Thời gian kết thúc phải ở tương lai' });
        }
        
        // Debug Log: Kiểm tra thời gian server nhận được để so sánh với thời gian người dùng nhập
        console.log(`📝 [API] Creating auction. Input EndTime: ${endTime}, Server Time: ${new Date().toISOString()}`);

        await pool.request()
            .input('pid', sql.Int, productId)
            .input('title', sql.NVarChar, productCheck.recordset[0].Name)
            .input('price', sql.Decimal(18, 2), startingPrice)
            .input('end', sql.DateTime2, endTime)
            // FIX: Thêm Status = 'Active' để đảm bảo phiên đấu giá được kích hoạt ngay lập tức
            .query(`INSERT INTO Auctions (ProductId, Title, StartingBid, CurrentBid, EndTime, Status) 
                    VALUES (@pid, @title, @price, @price, @end, 'Active')`);

        res.status(201).json({ message: 'Tạo phiên đấu giá thành công' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4.1 Cập nhật phiên đấu giá (Dành cho Seller)
router.put('/:id', verifyToken, authorizeRole(['Seller', 'Admin']), async (req, res) => {
    const { id } = req.params;
    const { title, startingPrice, endTime } = req.body;
    const userId = req.userId;

    try {
        const pool = await sql.connect();
        
        // Kiểm tra quyền và trạng thái đấu giá
        const check = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT a.HighestBidderId, p.SellerId FROM Auctions a JOIN Products p ON a.ProductId = p.Id WHERE a.Id = @id`);

        if (check.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy phiên đấu giá' });
        
        const auction = check.recordset[0];
        if (auction.SellerId !== userId) return res.status(403).json({ message: 'Bạn không có quyền sửa phiên đấu giá này' });
        if (auction.HighestBidderId !== null) return res.status(400).json({ message: 'Không thể sửa khi đã có người đặt giá' });

        await pool.request()
            .input('id', sql.Int, id)
            .input('title', sql.NVarChar, title)
            .input('price', sql.Decimal(18, 2), startingPrice)
            .input('end', sql.DateTime2, endTime)
            .query(`UPDATE Auctions SET Title = @title, StartingBid = @price, CurrentBid = @price, EndTime = @end WHERE Id = @id`);

        await redisDel(`auction:${id}`);
        res.json({ message: 'Cập nhật thành công' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Đặt giá (Place Bid)
router.post('/:id/bid', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { bidAmount } = req.body;
    const userId = req.userId;
    const lockKey = `lock:auction:${id}`;

    try {
        const lock = await redisSetLock(lockKey);
        if (!lock) return res.status(409).json({ message: 'Hệ thống đang xử lý, vui lòng thử lại' });

        const pool = await sql.connect();

        // KIỂM TRA SỐ DƯ TRƯỚC KHI ĐẶT GIÁ
        const userBalanceRes = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT Money FROM Users WHERE Id = @userId');
        const userBalance = userBalanceRes.recordset[0]?.Money || 0;
        if (Number(userBalance) < Number(bidAmount)) {
            await redisDel(lockKey);
            return res.status(400).json({ message: 'Số dư trong ví không đủ để đặt giá này.' });
        }

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT a.CurrentBid, a.EndTime, p.SellerId FROM Auctions a WITH (NOLOCK) JOIN Products p WITH (NOLOCK) ON a.ProductId = p.Id WHERE a.Id = @id');

        if (result.recordset.length === 0) {
            await redisDel(lockKey);
            return res.status(404).json({ message: 'Không tìm thấy phiên đấu giá' });
        }

        const auction = result.recordset[0];

        // Ngăn người bán tự đấu giá sản phẩm của mình
        if (auction.SellerId === userId) {
            await redisDel(lockKey);
            return res.status(403).json({ message: 'Bạn không thể đấu giá sản phẩm của chính mình' });
        }

        if (new Date(auction.EndTime) < new Date()) {
            await redisDel(lockKey);
            return res.status(400).json({ message: 'Phiên đấu giá đã kết thúc' });
        }

        if (Number(bidAmount) <= Number(auction.CurrentBid)) {
            await redisDel(lockKey);
            return res.status(400).json({ message: 'Giá đặt phải cao hơn giá hiện tại' });
        }

        await pool.request()
            .input('id', sql.Int, id)
            .input('bidAmount', sql.Decimal(18, 2), bidAmount)
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE Auctions SET CurrentBid = @bidAmount, HighestBidderId = @userId WHERE Id = @id;
                INSERT INTO Bids (AuctionId, UserId, BidAmount, BidTime) VALUES (@id, @userId, @bidAmount, GETDATE());
            `);

        await redisDel(`auction:${id}`);
        await redisDel(lockKey);

        const io = req.app.get('io');
        if (io) {
            io.emit('bidUpdate', { 
                auctionId: id, 
                bidAmount: bidAmount, 
                bidAmountVND: formatVND(bidAmount), 
                userId 
            });
        }

        res.json({ message: 'Đặt giá thành công', CurrentBidVND: formatVND(bidAmount) });
    } catch (error) {
        await redisDel(lockKey);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;