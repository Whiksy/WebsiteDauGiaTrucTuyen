const { getLogger } = require('../logger');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { validateNotEmpty } = require('../utils');
const { NotFoundError, ValidationError } = require('../errors');

/**
 * Category Service - Handles category management
 */
class CategoryService {
  constructor() {
    this.categoryRepository = RepositoryFactory.getCategoryRepository();
    this.logger = getLogger('CategoryService');
  }

  /**
   * Get all categories
   */
  async getAllCategories() {
    try {
      return await this.categoryRepository.findAll({}, 100, 0, 'name ASC');
    } catch (error) {
      this.logger.error('Failed to get all categories', error);
      throw error;
    }
  }

  /**
   * Create new category
   */
  async createCategory(name, description) {
    try {
      validateNotEmpty(name, 'Category name');
      const categoryId = await this.categoryRepository.create({
        name,
        description: description || null
      });
      this.logger.info(`Category ${categoryId} created: ${name}`);
      return categoryId;
    } catch (error) {
      this.logger.error(`Failed to create category ${name}`, error);
      throw error;
    }
  }

  /**
   * Update category
   */
  async updateCategory(categoryId, name, description) {
    try {
      validateNotEmpty(name, 'Category name');
      const category = await this.categoryRepository.findById(categoryId);
      if (!category) throw new NotFoundError('Category', categoryId);

      await this.categoryRepository.update(categoryId, {
        name,
        description: description || null
      });
      this.logger.info(`Category ${categoryId} updated`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update category ${categoryId}`, error);
      throw error;
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(categoryId) {
    try {
      await this.categoryRepository.delete(categoryId);
      this.logger.info(`Category ${categoryId} deleted`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete category ${categoryId}`, error);
      throw error;
    }
  }
}

module.exports = CategoryService;