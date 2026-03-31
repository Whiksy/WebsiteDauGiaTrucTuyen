const { getLogger } = require('../../logger');
const { ServiceFactory } = require('../../services/ServiceFactory');
const { SOCKET_EVENTS } = require('../../constants/AppConstants');

const logger = getLogger('WebSocket:AuctionHandler');

/**
 * Web Socket Auction Handler - Handles real-time auction updates
 */
class AuctionSocketHandler {
  constructor(io) {
    this.io = io;
    this.auctionService = ServiceFactory.getAuctionService();
    this.biddingService = ServiceFactory.getBiddingService();
  }

  /**
   * Handle user joining auction room
   */
  handleAuctionJoin(socket, data) {
    const { auctionId } = data;
    const room = `auction:${auctionId}`;

    socket.join(room);
    logger.info(`User ${socket.id} joined auction ${auctionId}`);

    // Notify others
    this.io.to(room).emit(SOCKET_EVENTS.USER_JOINED, {
      userId: socket.userId,
      message: 'User joined auction',
      timestamp: new Date()
    });
  }

  /**
   * Handle user leaving auction room
   */
  handleAuctionLeave(socket, data) {
    const { auctionId } = data;
    const room = `auction:${auctionId}`;

    socket.leave(room);
    logger.info(`User ${socket.id} left auction ${auctionId}`);

    // Notify others
    this.io.to(room).emit(SOCKET_EVENTS.USER_LEFT, {
      userId: socket.userId,
      message: 'User left auction',
      timestamp: new Date()
    });
  }

  /**
   * Handle new bid placed
   */
  async handleBidPlaced(socket, data) {
    try {
      const { auctionId, amount } = data;
      const room = `auction:${auctionId}`;
      const userId = socket.userId;

      // Place bid through service
      const bid = await this.biddingService.placeBid(auctionId, userId, parseFloat(amount));

      // Broadcast to all clients in auction room
      this.io.to(room).emit(SOCKET_EVENTS.BID_PLACED, {
        bidId: bid.bidId,
        auctionId: bid.auctionId,
        userId: bid.userId,
        amount: bid.amount,
        timestamp: bid.timestamp
      });

      logger.info(`Bid placed in auction ${auctionId}: user ${userId}, amount ${amount}`);
    } catch (error) {
      logger.error('Error placing bid', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: error.message,
        code: error.code || 'BID_ERROR'
      });
    }
  }

  /**
   * Handle auction update request
   */
  async handleAuctionUpdate(socket, data) {
    try {
      const { auctionId } = data;

      const auction = await this.auctionService.getAuction(auctionId);
      const room = `auction:${auctionId}`;

      this.io.to(room).emit(SOCKET_EVENTS.AUCTION_UPDATED, {
        id: auction.id,
        currentBid: auction.current_price,
        highestBidderId: auction.highest_bidder_id,
        bidCount: auction.bidCount,
        status: auction.status,
        endTime: auction.end_date,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error updating auction', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: error.message
      });
    }
  }
}

module.exports = AuctionSocketHandler;
