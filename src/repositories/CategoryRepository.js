const BaseRepository = require('./BaseRepository');

/**
 * Category Repository - Handles all category related database operations
 */
class CategoryRepository extends BaseRepository {
  constructor() {
    super('Categories');
  }
  // Add specific methods for Categories if needed
}

module.exports = CategoryRepository;