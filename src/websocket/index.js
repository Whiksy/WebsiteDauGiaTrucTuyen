const { getLogger } = require('../logger');
const AuctionSocketHandler = require('./handlers/AuctionHandler');
const ConnectionHandler = require('./handlers/ConnectionHandler');

const logger = getLogger('WebSocket');

/**
 * Initialize WebSocket handlers
 */
function initializeWebSocket(io) {
  logger.info('🔌 Initializing WebSocket...');

  const auctionHandler = new AuctionSocketHandler(io);

  io.on('connection', (socket) => {
    // Connection handlers
    ConnectionHandler.handleConnect(socket);

    // Lắng nghe sự kiện khi người dùng tham gia phòng riêng của họ
    socket.on('joinUser', (userId) => {
      socket.join(userId.toString());
      logger.info(`Socket ${socket.id} joined user room: ${userId}`);
    });

    // Auction event handlers
    socket.on('auction:join', (data) => auctionHandler.handleAuctionJoin(socket, data));
    socket.on('auction:leave', (data) => auctionHandler.handleAuctionLeave(socket, data));
    socket.on('bid:place', (data) => auctionHandler.handleBidPlaced(socket, data));
    socket.on('auction:update', (data) => auctionHandler.handleAuctionUpdate(socket, data));

    // Connection cleanup
    socket.on('disconnect', () => ConnectionHandler.handleDisconnect(socket));
    socket.on('error', (error) => ConnectionHandler.handleError(socket, error));
  });

  logger.info('✅ WebSocket initialized successfully');
  return io;
}

module.exports = { initializeWebSocket };
