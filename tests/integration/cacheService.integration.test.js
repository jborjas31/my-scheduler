// Integration tests for cache service
import { CacheService, cacheService, CacheKeys } from '../../src/js/services/cacheService.js';

describe('Cache Service Integration Tests', () => {
    let testCache;

    beforeEach(() => {
        testCache = new CacheService(1000); // 1 second TTL for testing
    });

    afterEach(() => {
        testCache.destroy();
        cacheService.clear();
    });

    describe('Cache and Fetch Integration', () => {
        test('should fetch data on cache miss and cache on hit', async () => {
            // Arrange
            let callCount = 0;
            const mockFetchFn = jest.fn(async () => {
                callCount++;
                return `data-${callCount}`;
            });

            // Act & Assert - First call (cache miss)
            const result1 = await testCache.getOrFetch('test-key', mockFetchFn);
            expect(result1).toBe('data-1');
            expect(mockFetchFn).toHaveBeenCalledTimes(1);

            // Act & Assert - Second call (cache hit)
            const result2 = await testCache.getOrFetch('test-key', mockFetchFn);
            expect(result2).toBe('data-1');
            expect(mockFetchFn).toHaveBeenCalledTimes(1); // Should not call again

            // Verify cache stats
            const stats = testCache.getStats();
            expect(stats.hitCount).toBe(1);
            expect(stats.missCount).toBe(1);
            expect(stats.hitRate).toBe('50.00');
        });

        test('should handle async fetch errors without caching', async () => {
            // Arrange
            const error = new Error('Fetch failed');
            const mockFetchFn = jest.fn().mockRejectedValue(error);

            // Act & Assert
            await expect(testCache.getOrFetch('error-key', mockFetchFn))
                .rejects.toThrow('Fetch failed');

            // Verify error was not cached
            expect(testCache.has('error-key')).toBe(false);
            
            // Verify stats
            const stats = testCache.getStats();
            expect(stats.missCount).toBe(1);
            expect(stats.hitCount).toBe(0);
        });

        test('should refetch after TTL expires', async () => {
            // Arrange
            let callCount = 0;
            const mockFetchFn = jest.fn(async () => {
                callCount++;
                return `data-${callCount}`;
            });

            // Act - First call
            const result1 = await testCache.getOrFetch('expire-key', mockFetchFn);
            expect(result1).toBe('data-1');

            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Act - Second call after expiry
            const result2 = await testCache.getOrFetch('expire-key', mockFetchFn);
            expect(result2).toBe('data-2');
            expect(mockFetchFn).toHaveBeenCalledTimes(2);
        });
    });

    describe('Cache Invalidation Patterns', () => {
        test('should invalidate cache entries by pattern', () => {
            // Arrange
            testCache.set('tasks:2024-01-15', ['task1']);
            testCache.set('tasks:2024-01-16', ['task2']);
            testCache.set('user:123:profile', { name: 'John' });
            testCache.set('user:456:profile', { name: 'Jane' });

            // Act
            testCache.invalidatePattern(/^tasks:/);

            // Assert
            expect(testCache.has('tasks:2024-01-15')).toBe(false);
            expect(testCache.has('tasks:2024-01-16')).toBe(false);
            expect(testCache.has('user:123:profile')).toBe(true);
            expect(testCache.has('user:456:profile')).toBe(true);
        });

        test('should invalidate cache entries by string pattern', () => {
            // Arrange
            testCache.set('cache:api:users', ['user1']);
            testCache.set('cache:api:tasks', ['task1']);
            testCache.set('session:user:123', { token: 'abc' });

            // Act
            testCache.invalidatePattern('cache:api');

            // Assert
            expect(testCache.has('cache:api:users')).toBe(false);
            expect(testCache.has('cache:api:tasks')).toBe(false);
            expect(testCache.has('session:user:123')).toBe(true);
        });
    });

    describe('Cache Key Generators', () => {
        test('should generate consistent cache keys', () => {
            // Act & Assert
            expect(CacheKeys.tasks('2024-01-15')).toBe('tasks:2024-01-15');
            expect(CacheKeys.task('task-123')).toBe('task:task-123');
            expect(CacheKeys.userTasks('user-456', '2024-01-15'))
                .toBe('user:user-456:tasks:2024-01-15');
            expect(CacheKeys.tasksByPriority('high', '2024-01-15'))
                .toBe('tasks:high:2024-01-15');
            expect(CacheKeys.completedTasks('2024-01-15'))
                .toBe('completed:2024-01-15');
        });
    });

    describe('Cache Cleanup and Management', () => {
        test('should automatically clean up expired entries', async () => {
            // Arrange
            const shortTTLCache = new CacheService(100); // 100ms TTL
            shortTTLCache.set('temp-key', 'temp-value');
            
            expect(shortTTLCache.has('temp-key')).toBe(true);

            // Wait for expiry
            await new Promise(resolve => setTimeout(resolve, 150));

            // Act - Trigger cleanup
            shortTTLCache.cleanup();

            // Assert
            expect(shortTTLCache.has('temp-key')).toBe(false);
            
            shortTTLCache.destroy();
        });

        test('should provide detailed cache entries for debugging', () => {
            // Arrange
            testCache.set('debug-key', 'debug-value', 5000);

            // Act
            const entries = testCache.getEntries();

            // Assert
            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({
                key: 'debug-key',
                value: 'debug-value',
                ttl: 5000,
                isExpired: false
            });
            expect(entries[0].remainingTime).toBeGreaterThan(4000);
            expect(entries[0].remainingTime).toBeLessThanOrEqual(5000);
        });

        test('should handle cache statistics correctly', async () => {
            // Arrange
            const mockFetch = jest.fn()
                .mockResolvedValueOnce('data1')
                .mockResolvedValueOnce('data2');

            // Act
            await testCache.getOrFetch('key1', () => mockFetch());
            await testCache.getOrFetch('key2', () => mockFetch());
            await testCache.getOrFetch('key1', () => mockFetch()); // Cache hit

            // Assert
            const stats = testCache.getStats();
            expect(stats.hitCount).toBe(1);
            expect(stats.missCount).toBe(2);
            expect(stats.totalRequests).toBe(3);
            expect(stats.hitRate).toBe('33.33');
            expect(stats.size).toBe(2);
        });
    });

    describe('Singleton Cache Service', () => {
        test('should maintain state across imports', () => {
            // Arrange
            cacheService.set('global-key', 'global-value');

            // Act & Assert
            expect(cacheService.has('global-key')).toBe(true);
            expect(cacheService.get('global-key')).toBe('global-value');

            // Verify it's the same instance
            const stats1 = cacheService.getStats();
            cacheService.set('another-key', 'another-value');
            const stats2 = cacheService.getStats();
            
            expect(stats2.size).toBe(stats1.size + 1);
        });
    });

    describe('Memory Management', () => {
        test('should not leak memory with periodic cleanup', async () => {
            // Arrange
            const memoryTestCache = new CacheService(50); // 50ms TTL
            
            // Add many items
            for (let i = 0; i < 100; i++) {
                memoryTestCache.set(`key-${i}`, `value-${i}`);
            }
            
            expect(memoryTestCache.getStats().size).toBe(100);

            // Wait for expiry
            await new Promise(resolve => setTimeout(resolve, 100));

            // Act - Items should be cleaned up automatically
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assert - Cache should be much smaller after cleanup
            expect(memoryTestCache.getStats().size).toBeLessThan(50);
            
            memoryTestCache.destroy();
        });

        test('should properly destroy cache and clean up resources', () => {
            // Arrange
            const destroyableCache = new CacheService();
            destroyableCache.set('test-key', 'test-value');
            
            expect(destroyableCache.getStats().size).toBe(1);

            // Act
            destroyableCache.destroy();

            // Assert
            expect(destroyableCache.getStats().size).toBe(0);
            expect(destroyableCache.cleanupInterval).toBeNull();
        });
    });
});