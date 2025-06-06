// Cache service for optimizing data fetching and reducing Firebase calls

/**
 * @typedef {Object} CacheItem
 * @property {any} value - The cached value
 * @property {number} expiresAt - Timestamp when the item expires
 * @property {number} createdAt - Timestamp when the item was created
 */

/**
 * @typedef {Object} CacheStats
 * @property {number} size - Number of items in cache
 * @property {number} hitCount - Number of cache hits
 * @property {number} missCount - Number of cache misses
 * @property {string} hitRate - Hit rate percentage as string
 * @property {number} totalRequests - Total number of requests
 */

/**
 * @typedef {Object} CacheEntry
 * @property {string} key - Cache key
 * @property {any} value - Cached value
 * @property {number} expiresAt - Expiration timestamp
 * @property {number} createdAt - Creation timestamp
 * @property {number} ttl - Time to live in milliseconds
 * @property {number} remainingTime - Remaining time before expiration
 * @property {boolean} isExpired - Whether the entry is expired
 */

export class CacheService {
    constructor(defaultTTL = 300000) { // 5 minutes default TTL
        this.cache = new Map();
        this.defaultTTL = defaultTTL;
        this.hitCount = 0;
        this.missCount = 0;
        
        // Clean expired entries every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);
    }

    /**
     * Get value from cache or fetch and store it
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Function to fetch data if not cached
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {Promise<any>} Cached or fetched data
     */
    async getOrFetch(key, fetchFn, ttl = this.defaultTTL) {
        const cached = this.get(key);
        if (cached !== null) {
            this.hitCount++;
            return cached;
        }

        this.missCount++;
        try {
            const result = await fetchFn();
            this.set(key, result, ttl);
            return result;
        } catch (error) {
            // Don't cache errors, let them bubble up
            throw error;
        }
    }

    /**
     * Set value in cache with TTL
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds
     */
    set(key, value, ttl = this.defaultTTL) {
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, {
            value,
            expiresAt,
            createdAt: Date.now()
        });
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {any|null} Cached value or null if not found/expired
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            return null;
        }

        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    /**
     * Check if key exists in cache and is not expired
     * @param {string} key - Cache key
     * @returns {boolean} True if key exists and is valid
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Delete specific key from cache
     * @param {string} key - Cache key to delete
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.hitCount = 0;
        this.missCount = 0;
    }

    /**
     * Remove expired entries from cache
     */
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Invalidate cache entries by pattern
     * @param {string|RegExp} pattern - Pattern to match keys
     */
    invalidatePattern(pattern) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache hit/miss statistics and size
     */
    getStats() {
        const totalRequests = this.hitCount + this.missCount;
        return {
            size: this.cache.size,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: totalRequests > 0 ? (this.hitCount / totalRequests * 100).toFixed(2) : 0,
            totalRequests
        };
    }

    /**
     * Get cache entries for debugging
     * @returns {Array} Array of cache entries with metadata
     */
    getEntries() {
        const entries = [];
        const now = Date.now();
        
        for (const [key, item] of this.cache.entries()) {
            entries.push({
                key,
                value: item.value,
                expiresAt: item.expiresAt,
                createdAt: item.createdAt,
                ttl: item.expiresAt - item.createdAt,
                remainingTime: Math.max(0, item.expiresAt - now),
                isExpired: now > item.expiresAt
            });
        }
        
        return entries;
    }

    /**
     * Destroy cache service and cleanup intervals
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clear();
    }
}

// Export singleton instance with default configuration
export const cacheService = new CacheService();

// Cache key generators for common patterns
export const CacheKeys = {
    tasks: (date) => `tasks:${date}`,
    task: (id) => `task:${id}`,
    userTasks: (userId, date) => `user:${userId}:tasks:${date}`,
    tasksByPriority: (priority, date) => `tasks:${priority}:${date}`,
    completedTasks: (date) => `completed:${date}`
};