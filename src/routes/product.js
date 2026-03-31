const express = require('express');
const { ServiceFactory } = require('../services/ServiceFactory');
const { authenticate } = require('../middleware');

const router = express.Router();
const productService = ServiceFactory.getProductService();
const auctionService = ServiceFactory.getAuctionService();

/**
 * @route   POST /api/products
 * @desc    Create product
 * @access  Private (Seller)
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, description, price, stock, categoryId, images } = req.body;

    const productId = await productService.createProduct(req.userId, {
      name,
      description,
      price,
      stock,
      categoryId,
      images
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { id: productId }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Get product details
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const product = await productService.getProduct(parseInt(req.params.id));

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/products/:id
 * @desc    Update product
 * @access  Private (Owner)
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const product = await productService.updateProduct(
      parseInt(req.params.id),
      req.userId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product
 * @access  Private (Owner)
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await productService.deleteProduct(parseInt(req.params.id), req.userId);
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/products/seller/:sellerId
 * @desc    Get seller products
 * @access  Public
 */
router.get('/seller/:sellerId', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const products = await productService.getSellerProducts(
      parseInt(req.params.sellerId),
      limit,
      offset
    );

    res.status(200).json({
      success: true,
      data: products,
      pagination: { limit, offset }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/products/search
 * @desc    Search products
 * @access  Public
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q: term } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const products = await productService.searchProducts(term || '', limit, offset);

    res.status(200).json({
      success: true,
      data: products,
      pagination: { limit, offset }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
