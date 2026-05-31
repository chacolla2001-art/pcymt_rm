/**
 * Object and data transformation utilities
 */

/**
 * Pick specific keys from an object
 * @param {object} obj - Source object
 * @param {string[]} keys - Keys to pick
 * @returns {object} New object with only specified keys
 */
const pick = (obj, keys) => {
  return keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

/**
 * Omit specific keys from an object
 * @param {object} obj - Source object
 * @param {string[]} keys - Keys to omit
 * @returns {object} New object without specified keys
 */
const omit = (obj, keys) => {
  const keysSet = new Set(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keysSet.has(key)),
  );
};

/**
 * Deep clone an object (handles dates, arrays, nested objects)
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone);
  }

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, deepClone(value)]),
  );
};

/**
 * Flatten a nested object
 * @param {object} obj - Nested object
 * @param {string} prefix - Key prefix
 * @param {string} separator - Key separator
 * @returns {object} Flattened object
 */
const flatten = (obj, prefix = '', separator = '.') => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(acc, flatten(value, newKey, separator));
    } else {
      acc[newKey] = value;
    }

    return acc;
  }, {});
};

/**
 * Remove null/undefined values from object
 * @param {object} obj - Source object
 * @param {boolean} deep - Apply recursively
 * @returns {object} Cleaned object
 */
const compact = (obj, deep = false) => {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        if (deep && value && typeof value === 'object' && !Array.isArray(value)) {
          return [key, compact(value, true)];
        }
        return [key, value];
      }),
  );
};

/**
 * Safe get nested property
 * @param {object} obj - Source object
 * @param {string} path - Dot-notation path
 * @param {*} defaultValue - Default value if not found
 * @returns {*}
 */
const get = (obj, path, defaultValue = undefined) => {
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }

  return result !== undefined ? result : defaultValue;
};

/**
 * Safe set nested property
 * @param {object} obj - Target object
 * @param {string} path - Dot-notation path
 * @param {*} value - Value to set
 * @returns {object} Modified object
 */
const set = (obj, path, value) => {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return obj;
};

/**
 * Group array by key
 * @param {Array} arr - Array to group
 * @param {string|Function} key - Key to group by or function
 * @returns {object} Grouped object
 */
const groupBy = (arr, key) => {
  const getKey = typeof key === 'function' ? key : (item) => item[key];

  return arr.reduce((groups, item) => {
    const group = getKey(item);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
    return groups;
  }, {});
};

/**
 * Unique array by key
 * @param {Array} arr - Array to deduplicate
 * @param {string|Function} key - Key to check uniqueness
 * @returns {Array} Unique array
 */
const uniqueBy = (arr, key) => {
  const getKey = typeof key === 'function' ? key : (item) => item[key];
  const seen = new Set();

  return arr.filter(item => {
    const k = getKey(item);
    if (seen.has(k)) {
      return false;
    }
    seen.add(k);
    return true;
  });
};

/**
 * Sort array by multiple keys
 * @param {Array} arr - Array to sort
 * @param {Array<{key: string, order: 'asc'|'desc'}>} keys - Sort keys
 * @returns {Array} Sorted array
 */
const sortBy = (arr, keys) => {
  return [...arr].sort((a, b) => {
    for (const { key, order = 'asc' } of keys) {
      const aVal = a[key];
      const bVal = b[key];

      if (aVal < bVal) {
        return order === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return order === 'asc' ? 1 : -1;
      }
    }
    return 0;
  });
};

module.exports = {
  pick,
  omit,
  deepClone,
  flatten,
  compact,
  get,
  set,
  groupBy,
  uniqueBy,
  sortBy,
};
