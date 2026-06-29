/**
 * Cache Middleware Factory
 * Creates middleware for caching API responses
 * 
 * Usage:
 * const { createCacheMiddleware } = require('./cache.middleware');
 * 
 * router.get('/users', 
 *   createCacheMiddleware('users:all', 300), // Cache for 5 minutes
 *   userController.getAll
 * );
 */

const { RedisCache, CacheKeys } = require('../../infrastructure/cache/cache.service');
const logger = require('../utils/logger.util');

const cache = new RedisCache();

/**
 * Create cache middleware
 * @param {string|Function} keyOrFn - Cache key or function to generate key from req
 * @param {number} ttl - Time to live in seconds
 * @returns {Function} Express middleware
 */
const createCacheMiddleware = (keyOrFn, ttl = 300) => {
  return async (req, res, next) => {
    // Skip cache in development if needed
    if (process.env.DISABLE_CACHE === 'true') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = typeof keyOrFn === 'function' 
        ? keyOrFn(req) 
        : keyOrFn;

      // Try to get from cache
      const cached = await cache.get(cacheKey);

      if (cached) {
        logger.debug('Cache hit', { key: cacheKey });
        return res.json(cached);
      }

      logger.debug('Cache miss', { key: cacheKey });

      // Store original res.json function
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.set(cacheKey, body, ttl).catch(err => {
            logger.error('Failed to cache response', { 
              key: cacheKey, 
              error: err.message 
            });
          });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', { error: error.message });
      next(); // Continue without cache on error
    }
  };
};

/**
 * Cache invalidation middleware
 * Use after operations that modify data
 * 
 * Usage:
 * router.post('/users', 
 *   userController.create,
 *   invalidateCache(['users:all', 'analytics:users'])
 * );
 */
const invalidateCache = (keys) => {
  return async (req, res, next) => {
    try {
      const promises = keys.map(key => {
        // Support pattern matching
        if (key.includes('*')) {
          return cache.delPattern(key);
        }
        return cache.del(key);
      });

      await Promise.all(promises);
      logger.debug('Cache invalidated', { keys });
    } catch (error) {
      logger.error('Cache invalidation error', { 
        keys, 
        error: error.message 
      });
    }

    next();
  };
};

/**
 * Predefined cache middleware for common routes
 */
const cacheMiddlewares = {
  // Cache all users list for 5 minutes
  users: createCacheMiddleware(CacheKeys.users(), 300),

  // Cache single user for 5 minutes, key includes user ID
  user: createCacheMiddleware(
    (req) => CacheKeys.user(req.params.id),
    300
  ),

  // Cache virtual assets for 10 minutes
  virtualAssets: createCacheMiddleware(CacheKeys.virtualAssets(), 600),

  // Cache anchor points for 10 minutes
  anchorPoints: createCacheMiddleware(CacheKeys.anchorPoints(), 600),

  // Cache analytics for 1 minute (frequently updated)
  analytics: (type) => createCacheMiddleware(
    CacheKeys.analytics(type),
    60
  ),
};

module.exports = {
  createCacheMiddleware,
  invalidateCache,
  cacheMiddlewares,
  cache, // Export cache instance for manual operations
};
