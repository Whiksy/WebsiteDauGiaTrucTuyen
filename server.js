const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const socketIo = require('socket.io');
const cron = require('node-cron');
const cors = require('cors');
const dotenv = require('dotenv');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const auctionRoutes = require('./routes/auction');
const productRoutes = require('./routes/product');
const paymentRoutes = require('./routes/payment');
const userRoutes = require('./routes/user');
const sellerRoutes = require('./routes/seller');
const adminRoutes = require('./routes/admin');
const { connectDB, sql } = require('./config/database');
const { connectRedis, client: redisClient } = require('./config/redis');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    transports: ['websocket', 'polling'] // Ưu tiên WebSocket để giảm tải server và tránh lag
  }
});

app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use(express.static('public'));

// Handle favicon.ico to prevent 404 errors in logs
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Định nghĩa đường dẫn tuyệt đối cho thư mục uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
console.log(`📂 Static Uploads Dir: ${uploadsDir}`);

// Xử lý phục vụ file tĩnh từ thư mục uploads (Thay thế express.static để debug tốt hơn)
app.use('/uploads', (req, res) => {
    const requestPath = decodeURIComponent(req.path);
    const safePath = requestPath.replace(/^(\/|\\)+/, ''); // Loại bỏ dấu / đầu tiên
    const fullPath = path.join(uploadsDir, safePath);

    if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
        return res.sendFile(fullPath);
    }
    
    res.status(404).send('File not found');
});

// Route cho trang kết quả thanh toán (Momo redirect về đây)
app.get('/payment/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payment_success.html'));
});

// Make io available to routes (so routes can emit)
app.set('io', io);

// --- BỘ XỬ LÝ ĐẤU GIÁ TỰ ĐỘNG ---
// (Nên được chuyển sang file service riêng để gọn gàng hơn)
let isProcessingAuctions = false; // Biến cờ để ngăn chặn chồng chéo cron job

const processEndedAuctions = async (ioInstance) => {
    if (isProcessingAuctions) {
        console.log('⚠️ [Cron] Job skipped - Previous job still running');
        return;
    }
    isProcessingAuctions = true;

    try {
        // Lấy các phiên đấu giá đã kết thúc nhưng vẫn còn 'Active'
        const endedAuctionsRes = await new sql.Request()
            .query(`
                SELECT a.Id, a.CurrentBid, a.HighestBidderId, p.SellerId 
                FROM Auctions a WITH (NOLOCK) 
                JOIN Products p WITH (NOLOCK) ON a.ProductId = p.Id 
                WHERE a.EndTime <= GETDATE() AND a.Status = 'Active'
            `);

        if (endedAuctionsRes.recordset.length === 0) {
            return;
        }

        console.log(`⏰ [Cron] Found ${endedAuctionsRes.recordset.length} auctions to process.`);

        for (const auction of endedAuctionsRes.recordset) {
            let transaction;
            let eventsToEmit = []; // Danh sách sự kiện cần gửi sau khi commit thành công
            try {
                transaction = new sql.Transaction();
                await transaction.begin();
                console.log(`▶️ [Processor] Processing Auction ${auction.Id} | Winner: ${auction.HighestBidderId} | Bid: ${auction.CurrentBid}`);
                // LƯU Ý: Tạo request mới cho mỗi câu lệnh để tránh lỗi trùng tham số

                if (auction.HighestBidderId) {
                    // Có người thắng cuộc
                    const winnerId = auction.HighestBidderId;
                    const finalPrice = Number(auction.CurrentBid); // Đảm bảo chuyển đổi sang số (tránh lỗi format '10.000,00')

                    // Kiểm tra lại số dư người thắng
                    const reqCheck = new sql.Request(transaction);
                    // FIX: Thêm WITH (UPDLOCK, ROWLOCK) để tránh Deadlock giữa lệnh SELECT và UPDATE
                    const winnerRes = await reqCheck.input('winnerId', sql.Int, winnerId).query('SELECT Money FROM Users WITH (UPDLOCK, ROWLOCK) WHERE Id = @winnerId');
                    const winnerBalance = winnerRes.recordset[0]?.Money || 0;

                    console.log(`   [Debug] User ${winnerId} Balance: ${winnerBalance} | Required: ${finalPrice}`);

                    if (Number(winnerBalance) >= Number(finalPrice)) {
                        console.log(`   [Processor] Balance OK. Executing payment...`);
                        // Đủ tiền -> Trừ tiền và hoàn tất
                        // FIX: Sử dụng tên tham số khác nhau (deductAmount, payAuctionId...) để tránh lỗi driver mssql trong transaction
                        const reqDeduct = new sql.Request(transaction);
                        const deductRes = await reqDeduct.input('deductAmount', sql.Decimal(18, 2), finalPrice).input('deductUserId', sql.Int, winnerId).query('UPDATE Users SET Money = Money - @deductAmount OUTPUT INSERTED.Money WHERE Id = @deductUserId');
                        const newWinnerBalance = deductRes.recordset[0]?.Money;
                        console.log(`   [Processor] Money deducted from User ${winnerId}. New Balance: ${newWinnerBalance}`);
                        
                        // Tạo mã giao dịch nội bộ để lưu vào MomoOrderId (tránh lỗi nếu cột này NOT NULL)
                        const walletTransId = `WALLET_${Date.now()}_${auction.Id}`;
                        console.log(`   [Debug] INSERTING PAYMENT: AuctionId=${auction.Id}, UserId=${winnerId}, Amount=${finalPrice}, OrderId=${walletTransId}`);
                        
                        const reqPay = new sql.Request(transaction);
                        await reqPay.input('payAuctionId', sql.Int, auction.Id).input('payUserId', sql.Int, winnerId).input('payAmount', sql.Decimal(18, 2), finalPrice).input('payOrderId', sql.NVarChar, walletTransId).query("INSERT INTO Payments (AuctionId, UserId, Amount, Status, Type, MomoOrderId) VALUES (@payAuctionId, @payUserId, @payAmount, 'Paid', 'Wallet', @payOrderId)");
                        console.log(`   [Processor] Payment record inserted.`);
                        
                        // Cộng tiền cho người bán (Seller)
                        let newSellerBalance = null;
                        if (auction.SellerId) {
                            const reqCredit = new sql.Request(transaction);
                            const creditRes = await reqCredit.input('creditAmount', sql.Decimal(18, 2), finalPrice).input('creditSellerId', sql.Int, auction.SellerId).query('UPDATE Users SET Money = ISNULL(Money, 0) + @creditAmount OUTPUT INSERTED.Money WHERE Id = @creditSellerId');
                            newSellerBalance = creditRes.recordset[0]?.Money;
                            console.log(`   [Processor] Credited ${finalPrice} to Seller ${auction.SellerId}`);
                        }

                        const reqUpdate = new sql.Request(transaction);
                        await reqUpdate.input('endAuctionId', sql.Int, auction.Id).query("UPDATE Auctions SET Status = 'Ended' WHERE Id = @endAuctionId");
                        console.log(`   [Processor] Auction status updated to Ended.`);
                        
                        console.log(`✅ [Processor] SUCCESS: Auction ${auction.Id} ended. User ${winnerId} paid ${finalPrice}.`);
                        if (ioInstance) {
                            // Xếp hàng sự kiện để gửi sau khi commit
                            eventsToEmit.push({ room: `user_${winnerId}`, event: 'auctionWin', data: { auctionId: auction.Id, message: `Chúc mừng! Bạn đã thắng đấu giá #${auction.Id}.` } });
                            eventsToEmit.push({ room: `user_${winnerId}`, event: 'balanceUpdate', data: { balance: newWinnerBalance } });
                            
                            if (auction.SellerId) {
                                eventsToEmit.push({ room: `user_${auction.SellerId}`, event: 'productSold', data: { auctionId: auction.Id, message: `Sản phẩm #${auction.Id} đã được bán với giá ${finalPrice}.` } });
                                if (newSellerBalance !== null) {
                                    eventsToEmit.push({ room: `user_${auction.SellerId}`, event: 'balanceUpdate', data: { balance: newSellerBalance } });
                                }
                            }
                        }
                    } else {
                        console.log(`   [Processor] Balance insufficient.`);
                        // Không đủ tiền
                        const reqFail = new sql.Request(transaction);
                        await reqFail.input('failAuctionId', sql.Int, auction.Id).query("UPDATE Auctions SET Status = 'PaymentFailed' WHERE Id = @failAuctionId");
                        console.log(`❌ [Processor] FAILED: Auction ${auction.Id} ended. User ${winnerId} has insufficient funds.`);
                        if (ioInstance) {
                            eventsToEmit.push({ room: `user_${winnerId}`, event: 'paymentFail', data: { auctionId: auction.Id, message: `Thanh toán cho đấu giá #${auction.Id} thất bại do không đủ số dư.` } });
                        }
                    }
                } else {
                    // Không có ai đấu giá -> Chỉ cần kết thúc
                    const reqEnd = new sql.Request(transaction);
                    await reqEnd.input('auctionId', sql.Int, auction.Id).query("UPDATE Auctions SET Status = 'Ended' WHERE Id = @auctionId");
                    console.log(`ℹ️ [Processor] Auction ${auction.Id} ended with no bidders.`);
                }

                await transaction.commit();
                console.log(`✅ [Processor] Transaction committed for Auction ${auction.Id}`);
                
                // Gửi sự kiện Socket SAU KHI commit DB thành công để đảm bảo Client đọc được dữ liệu mới nhất
                if (ioInstance && eventsToEmit.length > 0) {
                    eventsToEmit.forEach(e => ioInstance.to(e.room).emit(e.event, e.data));
                }
            } catch (err) {
                console.error(`❌ [Processor] Error processing auction ${auction.Id}:`, err);
                if (err.originalError) console.error('   [SQL Detail]:', err.originalError.message);
                if (transaction) {
                    try {
                    await transaction.rollback();
                    console.log(`   [Processor] Rolled back Auction ${auction.Id}`);
                    } catch (rbErr) {
                    console.error(`   [Processor] Rollback failed:`, rbErr.message);
                    }
                }
            }
        }
    } catch (err) {
        console.error('❌ [Cron] Global error in processEndedAuctions:', err);
        console.error(err.stack);
    } finally {
        isProcessingAuctions = false; // Giải phóng cờ để lần chạy sau có thể tiếp tục
    }
};

// Global error logging for unexpected errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && (err.stack || err));
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason && (reason.stack || reason));
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auction', auctionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/admin', adminRoutes);

// Socket.io for real-time bidding
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinAuction', (auctionId) => {
    socket.join(auctionId);
  });

  // Cho phép user join vào room riêng để nhận thông báo (số dư, kết quả đấu giá...)
  socket.on('joinUser', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('placeBid', async (data) => {
    // Handle bid logic here
    const { auctionId, bidAmount, userId } = data;
    // Process bid, update Redis, emit to room
    io.to(auctionId).emit('bidUpdate', { bidAmount, userId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Tác vụ tự động chạy mỗi phút để xử lý các phiên đấu giá đã kết thúc
cron.schedule('* * * * *', () => {
  // Chỉ log khi bắt đầu xử lý để tránh spam console nếu job chạy quá nhanh
  if (!isProcessingAuctions) {
      // console.log('⏰ [Cron] Checking ended auctions...'); // Uncomment nếu muốn debug
      processEndedAuctions(io); 
  }
});

const PORT = Number(process.env.PORT || 5200);

const init = async () => {
  console.log('🚀 Đang khởi động server...');
  const dbOk = await connectDB();
  const redisOk = await connectRedis();

  // --- FIX: Tự động sửa lỗi dữ liệu (Data Integrity Check) ---
  if (dbOk) {
      try {
          console.log('🔧 [System] Checking data integrity...');
          const request = new sql.Request();
          // 1. Cập nhật các phiên đấu giá bị NULL Status thành 'Active' để hệ thống có thể xử lý tiếp
          await request.query("UPDATE Auctions SET Status = 'Active' WHERE Status IS NULL");
          console.log('✅ [System] Data integrity check passed. Fixed NULL statuses.');
      } catch (err) {
          console.error('⚠️ [System] Data integrity check failed:', err.message);
      }
  }

  // Fetch some initial data counts from SQL to show progress
  const fetchInitialData = async () => {
    try {
      if (!dbOk) {
        console.warn('Skipping initial SQL data load because DB connection failed.');
        return;
      }
      const request = new sql.Request();
      const auctionsRes = await request.query('SELECT COUNT(*) as cnt FROM Auctions');
      const usersRes = await request.query('SELECT COUNT(*) as cnt FROM Users');
      const auctionsCount = auctionsRes.recordset[0]?.cnt ?? 0;
      const usersCount = usersRes.recordset[0]?.cnt ?? 0;
      console.log(`📦 Initial load: ${auctionsCount} auctions, ${usersCount} users loaded from SQL`);
    } catch (err) {
      console.error('Initial SQL data load failed:', err && (err.stack || err));
    }
  };

  await fetchInitialData();

  // Log Redis connection status
  try {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT || 6379;
    if (redisOk && redisClient && redisClient.isOpen) {
      console.log(`📌 Redis available at ${host}:${port}`);
    } else {
      console.warn('⚠️ Redis not available; using in-memory fallback for cache/locks');
    }
  } catch (e) {
    console.error('Redis status check failed:', e && (e.stack || e));
  }

  // Start server with retry if port is in use
  const startServer = (port, attempts = 0) => {
    const maxAttempts = 5;
    server.once('listening', () => {
      const host = process.env.HOST || 'localhost';
      console.log(`✅ Server running -> http://${host}:${port}`);

      // Hiển thị Public URL nếu đã cấu hình
      const appSettings = require('./config/appsettings');
      if (appSettings.PublicUrl) {
        console.log(`🌍 Public URL:   ${appSettings.PublicUrl} (Gửi link này cho người khác)`);
      }
    });

    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && attempts < maxAttempts) {
        const nextPort = port + 1;
        console.warn(`Port ${port} in use, retrying on ${nextPort}...`);
        setTimeout(() => startServer(nextPort, attempts + 1), 500);
      } else {
        console.error('Server failed to start:', err && (err.stack || err));
        process.exit(1);
      }
    });

    try {
      server.listen(port);
    } catch (e) {
      console.error('Listen failed:', e && (e.stack || e));
    }
  };

  startServer(PORT);
};

init();