/**
 * Simple in-memory cache utility
 * For production, consider using Redis
 */
class CacheUtil {
  constructor(options = {}) {
    this.cache = new Map();
    this.defaultTTL = options.ttl || 300000; // 5 minutes default
    this.maxSize = options.maxSize || 1000;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return item.value;
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = this.defaultTTL) {
    // Evict oldest entries if max size reached
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Delete all values matching a pattern
   * @param {string} pattern - Pattern to match (supports wildcards at end)
   */
  /**
   * Delete all values matching a pattern
   * @param {string} pattern - Pattern to match (supports wildcards at end)
   * @returns {number} Number of deleted entries
   */
  deletePattern(pattern) {
    const prefix = pattern.replace(/\*$/, '');
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? `${(this.hits / total * 100).toFixed(2)}%` : '0%',
    };
  }

  /**
   * Get or set cache value (cache-aside pattern)
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch value if not cached
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<*>} Cached or fetched value
   */
  async getOrSet(key, fetchFn, ttl = this.defaultTTL) {
    const cached = this.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const value = await fetchFn();

    // Only cache non-null values
    if (value !== null && value !== undefined) {
      this.set(key, value, ttl);
    }

    return value;
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const item = this.cache.get(key);

    if (!item) {
      return false;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get remaining TTL for a key
   * @param {string} key - Cache key
   * @returns {number} Remaining TTL in milliseconds, -1 if not found
   */
  ttl(key) {
    const item = this.cache.get(key);

    if (!item) {
      return -1;
    }

    const remaining = item.expiresAt - Date.now();
    return remaining > 0 ? remaining : -1;
  }

  /**
   * Memoize an async function
   * @param {Function} fn - Async function to memoize
   * @param {Function} keyGenerator - Function to generate cache key from arguments
   * @param {number} ttl - Cache TTL
   * @returns {Function} Memoized function
   */
  memoize(fn, keyGenerator, ttl = this.defaultTTL) {
    return async (...args) => {
      const key = keyGenerator(...args);
      return this.getOrSet(key, () => fn(...args), ttl);
    };
  }

  /**
   * Cleanup expired entries (call periodically)
   * @returns {number} Number of expired entries removed
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

// Singleton instance for application-wide caching
const appCache = new CacheUtil({ ttl: 300000, maxSize: 500 });

// Periodic cleanup every 5 minutes
setInterval(() => {
  appCache.cleanup();
}, 5 * 60 * 1000);

// Cache key generators for common entities
const cacheKeys = {
  user: (id) => `user:${id}`,
  userByEmail: (email) => `user:email:${email.toLowerCase()}`,
  users: (params = {}) => `users:${JSON.stringify(params)}`,
  animalModel: (id) => `animalModel:${id}`,
  animalModels: (params = {}) => `animalModels:${JSON.stringify(params)}`,
  anchorPoint: (id) => `anchorPoint:${id}`,
  anchorPoints: (modelId) => `anchorPoints:model:${modelId}`,
  analytics: (type, params = {}) => `analytics:${type}:${JSON.stringify(params)}`,
  session: (sessionId) => `session:${sessionId}`,
};

module.exports = {
  CacheUtil,
  appCache,
  cacheKeys,
};
