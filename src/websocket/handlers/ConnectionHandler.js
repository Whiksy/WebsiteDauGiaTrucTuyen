const { getLogger } = require('../../logger');
const { SOCKET_EVENTS } = require('../../constants/AppConstants');

const logger = getLogger('WebSocket:ConnectionHandler');

/**
 * WebSocket Connection Handler - Manages socket connections
 */
class ConnectionHandler {
  /**
   * Handle socket connection
   */
  static handleConnect(socket) {
    logger.info(`Client connected: ${socket.id}`);

    socket.emit(SOCKET_EVENTS.CONNECTED, {
      socketId: socket.id,
      message: 'Connected to auction server',
      timestamp: new Date()
    });
  }

  /**
   * Handle socket disconnection
   */
  static handleDisconnect(socket) {
    logger.info(`Client disconnected: ${socket.id}`);

    // Clean up any room subscriptions
    socket.removeAllListeners();
  }

  /**
   * Handle socket error
   */
  static handleError(socket, error) {
    logger.error(`Socket error for ${socket.id}:`, error);

    socket.emit(SOCKET_EVENTS.ERROR, {
      message: error.message || 'Socket error occurred',
      timestamp: new Date()
    });
  }
}

module.exports = ConnectionHandler;
