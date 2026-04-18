const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');

const { getConfig } = require('./config');
const { getLogger } = require('./logger');
const { registerRoutes } = require('./routes');
const { getRedisClient } = require('./config/redis');
const { errorHandler, notFound, requestLogger, responseTime, authenticate } = require('./middleware');
const { initializeWebSocket } = require('./websocket');
const { initializeSocket } = require('./services/SocketManager');
const passport = require('./config/passport');

const logger = getLogger('Express');
const config = getConfig();

/**
 * Create and configure Express application
 */
function createApp() {
  const app = express();

  // Trust proxy
  app.set('trust proxy', 1);

  // CORS
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', config.get('PUBLIC_URL')],
    credentials: true
  }));

  // Body parser
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Tích hợp Redis vào Session (để lưu phiên đăng nhập lâu dài)
  const redisClient = getRedisClient();
  let sessionStore;
  if (redisClient) {
    const RedisStore = require('connect-redis').default || require('connect-redis');
    sessionStore = new RedisStore({
      client: redisClient,
      prefix: 'auction:session:'
    });
  }

  // Session
  app.use(session({
    store: sessionStore,
    secret: config.get('SESSION.SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.get('SESSION.COOKIE_SECURE'),
      httpOnly: config.get('SESSION.COOKIE_HTTP_ONLY'),
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Khởi tạo Passport
  app.use(passport.initialize());

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Middleware
  app.use(requestLogger);
  app.use(responseTime);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Server is running',
      timestamp: new Date(),
      environment: config.get('NODE_ENV')
    });
  });

  // API Routes
  registerRoutes(app);

  // Serve static pages
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'register.html'));
  });

  app.get('/payment/success', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'payment_success.html'));
  });

  // Error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

/**
 * Create HTTP server with Socket.io
 */
function createServer(app) {
  const server = http.createServer(app);

  const io = socketIo(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001', config.get('PUBLIC_URL')],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Attach IO instance to app for routes to use if needed
  app.set('io', io);

  // Initialize WebSocket handlers
  initializeWebSocket(io);

  // Khởi tạo SocketManager toàn cục để các Service (như AuctionService) có thể gọi
  initializeSocket(io);

  return server;
}

module.exports = {
  createApp,
  createServer
};
