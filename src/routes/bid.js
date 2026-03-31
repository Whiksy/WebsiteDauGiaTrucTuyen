const express = require('express');
const { ServiceFactory } = require('../services/ServiceFactory');
const { authenticate } = require('../middleware');

const router = express.Router();
const biddingService = ServiceFactory.getBiddingService();

/**
 * @route   GET /api/my-bids
 * @desc    Get user bids
 * @access  Private
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const bids = await biddingService.getUserBids(req.userId, limit, offset);

    res.status(200).json({
      success: true,
      data: bids,
      pagination: { limit, offset }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
