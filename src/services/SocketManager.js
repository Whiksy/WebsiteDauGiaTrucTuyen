const { getLogger } = require('../logger');
const logger = getLogger('SocketManager');

let io = null;

/**
 * Khởi tạo instance Socket.IO server.
 * Hàm này nên được gọi một lần duy nhất trong file server.js.
 * @param {import('socket.io').Server} serverInstance - Instance của Socket.IO server.
 */
function initializeSocket(serverInstance) {
  if (io) {
    logger.warn('Socket.IO đã được khởi tạo trước đó.');
    return;
  }
  io = serverInstance;
  logger.info('✅ Trình quản lý Socket.IO đã được khởi tạo.');
}

/**
 * Trả về instance Socket.IO server toàn cục.
 * @returns {import('socket.io').Server} Instance của Socket.IO server.
 */
function getSocket() {
  if (!io) {
    throw new Error('Socket.IO chưa được khởi tạo! Hãy gọi initializeSocket trước.');
  }
  return io;
}

module.exports = { initializeSocket, getSocket };