const express = require('express');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { ServiceFactory } = require('../services/ServiceFactory');
const categoryService = ServiceFactory.getCategoryService();

const router = express.Router();

/**
 * @route   GET /api/categories
 * @desc    Lấy danh sách tất cả danh mục (Dành cho Seller dropdown)
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const categories = await categoryService.getAllCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) { next(error); }
});

module.exports = router;