/**
 * Async utilities for cleaner async/await patterns
 */

/**
 * Execute multiple promises in parallel with error handling
 * Returns results and errors separately
 * @param {Array<Promise>} promises - Array of promises
 * @returns {Promise<{ results: Array, errors: Array }>}
 */
const settleAll = async (promises) => {
  const settled = await Promise.allSettled(promises);

  const results = [];
  const errors = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      results.push({ index, value: result.value });
    } else {
      errors.push({ index, error: result.reason });
    }
  });

  return { results, errors };
};

/**
 * Execute promises in batches to avoid overwhelming resources
 * @param {Array<Function>} tasks - Array of functions returning promises
 * @param {number} batchSize - Maximum concurrent tasks
 * @returns {Promise<Array>} Results in order
 */
const batchExecute = async (tasks, batchSize = 5) => {
  const results = [];

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(task => task()));
    results.push(...batchResults);
  }

  return results;
};

/**
 * Retry an async operation with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {object} options - Retry options
 * @returns {Promise<*>} Result of the function
 */
const retry = async (fn, options = {}) => {
  const {
    attempts = 3,
    delay = 1000,
    factor = 2,
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        break;
      }

      const waitTime = delay * Math.pow(factor, attempt - 1);

      if (onRetry) {
        onRetry(error, attempt, waitTime);
      }

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
};

/**
 * Execute with timeout
 * @param {Promise} promise - Promise to execute
 * @param {number} ms - Timeout in milliseconds
 * @param {string} errorMessage - Custom timeout error message
 * @returns {Promise<*>}
 */
const withTimeout = (promise, ms, errorMessage = 'Operation timed out') => {
  const timeout = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(errorMessage));
    }, ms);
  });

  return Promise.race([promise, timeout]);
};

/**
 * Debounce an async function
 * @param {Function} fn - Async function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
const debounceAsync = (fn, wait = 300) => {
  let timeoutId = null;
  let pendingPromise = null;

  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await fn(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            pendingPromise = null;
            timeoutId = null;
          }
        }, wait);
      });
    }

    return pendingPromise;
  };
};

/**
 * Create a deferred promise (externally resolvable)
 * @returns {{ promise: Promise, resolve: Function, reject: Function }}
 */
const createDeferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/**
 * Sleep/delay helper
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  settleAll,
  batchExecute,
  retry,
  withTimeout,
  debounceAsync,
  createDeferred,
  sleep,
};
