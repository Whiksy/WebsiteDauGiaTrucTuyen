const { getLogger } = require('../logger');
const { getDatabaseManager } = require('../repositories/RepositoryFactory');

const logger = getLogger('CacheService');

/**
 * Cache Service - Simple in-memory cache with Redis fallback
 */
class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttls = new Map();
  }

  /**
   * Get value from cache
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    // Check TTL
    if (this.ttls.has(key)) {
      const expiryTime = this.ttls.get(key);
      if (Date.now() > expiryTime) {
        this.cache.delete(key);
        this.ttls.delete(key);
        return null;
      }
    }

    return this.cache.get(key);
  }

  /**
   * Set value in cache with optional TTL (in seconds)
   */
  set(key, value, ttl = null) {
    this.cache.set(key, value);

    if (ttl) {
      this.ttls.set(key, Date.now() + ttl * 1000);
    }

    logger.debug(`Cache SET: ${key}`);
  }

  /**
   * Delete from cache
   */
  delete(key) {
    this.cache.delete(key);
    this.ttls.delete(key);
    logger.debug(`Cache DEL: ${key}`);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.ttls.clear();
    logger.debug('Cache CLEAR');
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }
}

// Singleton instance
let instance = null;

function getCacheService() {
  if (!instance) {
    instance = new CacheService();
  }
  return instance;
}

module.exports = { CacheService, getCacheService };
