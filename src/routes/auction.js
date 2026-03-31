const express = require('express');
const { ServiceFactory } = require('../services/ServiceFactory');
const { authenticate, optionalAuth } = require('../middleware');


const router = express.Router();
const auctionService = ServiceFactory.getAuctionService();
const biddingService = ServiceFactory.getBiddingService();

/**
 * @route   POST /api/auctions
 * @desc    Tạo phiên đấu giá mới
 * @access  Private (Seller)
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { productId, startingPrice, endTime, reservePrice, minBidIncrement } = req.body;

    const auctionId = await auctionService.createAuction(req.userId, {
      productId,
      startingBid: startingPrice,
      endTime,
      reservePrice,
      minBidIncrement
    });

    res.status(201).json({
      success: true,
      message: 'Tạo phiên đấu giá thành công',
      data: { id: auctionId }
    });
  } catch (error) {
    next(error);
  }
});


/**
 * @route   GET /api/auctions
 * @desc    Get all active auctions
 * @access  Public
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const auctions = await auctionService.getActiveAuctions(limit, offset);

    res.status(200).json({
      success: true,
      data: auctions,
      pagination: { limit, offset }
    });
  } catch (error) {
    next(error);
  }
});


/**
 * @route   GET /api/auctions/ended
 * @desc    Get ended auctions
 * @access  Public
 */
router.get('/ended', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const auctions = await auctionService.getEndedAuctions(limit, offset);

    res.status(200).json({
      success: true,
      data: auctions,
      pagination: { limit, offset }
    });
  } catch (error) {
    next(error);
  }
});


/**
 * @route   GET /api/auctions/search
 * @desc    Search auctions
 * @access  Public
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q: term, minPrice, maxPrice, status, category } = req.query;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const filters = {};
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (status) filters.status = status;
    if (category) filters.categoryId = parseInt(category);

    const auctions = await auctionService.searchAuctions(term || '', filters, limit, offset);

    res.status(200).json({
      success: true,
      data: auctions,
      pagination: { limit, offset }
    });
  } catch (error) {
    next(error);
  }
});


/**
 * @route   GET /api/auctions/:id
 * @desc    Get auction details
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const auction = await auctionService.getAuction(parseInt(req.params.id));

    res.status(200).json({
      success: true,
      data: auction
    });
  } catch (error) {
    next(error);
  }
});


/**
 * @route   POST /api/auctions/:id/bid
 * @desc    Place bid on auction
 * @access  Private
 */
router.post('/:id/bid', authenticate, async (req, res, next) => {
  try {
    const bidAmount = Number(req.body.bidAmount);
    const auctionId = parseInt(req.params.id);

    const bid = await biddingService.placeBid(auctionId, req.userId, bidAmount);

    res.status(201).json({
      success: true,
      message: 'Bid placed successfully',
      data: bid
    });
  } catch (error) {
    next(error);
  }
});


/**
 * @route   GET /api/auctions/:id/bids
 * @desc    Get auction bid history
 * @access  Public
 */
router.get('/:id/bids', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const auctionId = parseInt(req.params.id);

    const bids = await biddingService.getAuctionBidHistory(auctionId, limit, offset);

    res.status(200).json({
      success: true,
      data: bids,
      pagination: { limit, offset }
    });
  } catch (error) {
    next(error);
  }
});


/**
 * @route   GET /api/auctions/seller/:sellerId
 * @desc    Get all auctions by seller
 * @access  Public
 */
router.get('/seller/:sellerId', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const auctions = await auctionService.getSellerAuctions(
      parseInt(req.params.sellerId),
      limit,
      offset
    );

    res.status(200).json({
      success: true,
      data: auctions,
      pagination: { limit, offset }
    });
  } catch (error) {
    next(error);
  }
});


module.exports = router;
