const BaseRepository = require('./BaseRepository');

/**
 * Activity Repository - Handles all activity log related database operations
 */
class ActivityRepository extends BaseRepository {
  constructor() {
    super('Activities');
  }
  // Add specific methods for Activities if needed
}

module.exports = ActivityRepository;