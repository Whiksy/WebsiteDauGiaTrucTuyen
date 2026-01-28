const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const socketIo = require('socket.io');
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
    methods: ["GET", "POST"]
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

// Make io available to routes (so routes can emit)
app.set('io', io);

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

const PORT = Number(process.env.PORT || 5200);

const init = async () => {
  console.log('🚀 Đang khởi động server...');
  const dbOk = await connectDB();
  const redisOk = await connectRedis();

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