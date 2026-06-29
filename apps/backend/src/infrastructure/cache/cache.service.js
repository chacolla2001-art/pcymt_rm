/**
 * Redis Cache Service
 * Provides caching layer for frequently accessed data
 * 
 * Installation: npm install ioredis
 * 
 * Usage:
 * const { RedisCache } = require('./cache.service');
 * const cache = new RedisCache();
 * await cache.set('key', data, 3600); // TTL in seconds
 * const data = await cache.get('key');
 */

// Redis cache - requires: npm install ioredis
const Redis = require('ioredis');
const logger = require('../../shared/utils/logger.util');

/**
 * Redis Cache Service
 * Implements caching with automatic serialization/deserialization
 */
class RedisCache {
  constructor() {
    this.enabled = process.env.REDIS_URL ? true : false;
    
    if (this.enabled) {
      this.client = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      this.client.on('error', (err) => {
        logger.error('Redis error', { error: err.message });
      });
    } else {
      logger.info('Redis cache disabled (REDIS_URL not set)');
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null
   */
  async get(key) {
    if (!this.enabled) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 3600)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = 3600) {
    if (!this.enabled) return false;

    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    if (!this.enabled) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete keys matching pattern
   * @param {string} pattern - Key pattern (e.g., 'user:*')
   * @returns {Promise<number>} Number of deleted keys
   */
  async delPattern(pattern) {
    if (!this.enabled) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return keys.length;
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error: error.message });
      return 0;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Exists status
   */
  async exists(key) {
    if (!this.enabled) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Clear all cache
   * @returns {Promise<boolean>} Success status
   */
  async flush() {
    if (!this.enabled) return false;

    try {
      await this.client.flushdb();
      logger.info('Cache flushed successfully');
      return true;
    } catch (error) {
      logger.error('Cache flush error', { error: error.message });
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.enabled && this.client) {
      await this.client.quit();
      logger.info('Redis disconnected');
    }
  }
}

/**
 * Cache key generators for different entities
 */
const CacheKeys = {
  user: (id) => `user:${id}`,
  users: () => 'users:all',
  virtualAsset: (id) => `asset:${id}`,
  virtualAssets: () => 'assets:all',
  anchorPoint: (id) => `anchor:${id}`,
  anchorPoints: () => 'anchors:all',
  analytics: (type) => `analytics:${type}`,
};

module.exports = {
  RedisCache,
  CacheKeys,
};
