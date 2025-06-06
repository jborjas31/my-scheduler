// Tests for performance monitoring utilities
import { 
    performanceMonitor, 
    startTimer, 
    endTimer, 
    measure, 
    measureSync, 
    getStats, 
    generateReport,
    withPerformanceMonitoring
} from '../../src/js/utils/performanceMonitor.js';

// Mock performance API
global.performance = {
    now: jest.fn(() => Date.now()),
    memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000
    },
    getEntriesByType: jest.fn(() => [])
};

// Mock PerformanceObserver
global.PerformanceObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn()
}));

describe('Performance Monitor', () => {
    beforeEach(() => {
        performanceMonitor.clear();
        jest.clearAllMocks();
        
        // Reset performance.now to return incremental values
        let counter = 0;
        performance.now.mockImplementation(() => {
            counter += 10; // Each call advances by 10ms
            return counter;
        });
    });

    describe('Timer Operations', () => {
        test('should start and end timer correctly', () => {
            // Act
            startTimer('test-operation');
            const metric = endTimer('test-operation');

            // Assert
            expect(metric).toMatchObject({
                name: 'test-operation',
                duration: 10 // Based on our mock implementation
            });
            expect(metric.startTime).toBeDefined();
            expect(metric.endTime).toBeDefined();
        });

        test('should handle timer with metadata', () => {
            // Arrange
            const metadata = { userId: '123', action: 'load' };

            // Act
            startTimer('user-action', metadata);
            const metric = endTimer('user-action');

            // Assert
            expect(metric.metadata).toEqual(metadata);
        });

        test('should warn when ending non-existent timer', () => {
            // Arrange
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            // Act
            const metric = endTimer('non-existent');

            // Assert
            expect(metric).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                "Performance timer 'non-existent' was not started"
            );

            consoleSpy.mockRestore();
        });

        test('should clean up timer data after ending', () => {
            // Act
            startTimer('cleanup-test');
            endTimer('cleanup-test');
            
            // Try to end again
            const metric = endTimer('cleanup-test');

            // Assert
            expect(metric).toBeNull();
        });
    });

    describe('Measure Functions', () => {
        test('should measure async function execution', async () => {
            // Arrange
            const asyncFn = jest.fn(async () => {
                await new Promise(resolve => setTimeout(resolve, 0));
                return 'result';
            });

            // Act
            const result = await measure('async-operation', asyncFn);

            // Assert
            expect(result).toBe('result');
            expect(asyncFn).toHaveBeenCalled();
            
            const stats = getStats('async-operation');
            expect(stats).toBeDefined();
            expect(stats.count).toBe(1);
        });

        test('should measure sync function execution', () => {
            // Arrange
            const syncFn = jest.fn(() => 'sync-result');

            // Act
            const result = measureSync('sync-operation', syncFn);

            // Assert
            expect(result).toBe('sync-result');
            expect(syncFn).toHaveBeenCalled();
            
            const stats = getStats('sync-operation');
            expect(stats.count).toBe(1);
        });

        test('should handle function errors in measure', async () => {
            // Arrange
            const errorFn = jest.fn(async () => {
                throw new Error('Test error');
            });

            // Act & Assert
            await expect(measure('error-operation', errorFn)).rejects.toThrow('Test error');
            
            // Verify metric was still recorded
            const stats = getStats('error-operation');
            expect(stats.count).toBe(1);
        });

        test('should handle function errors in measureSync', () => {
            // Arrange
            const errorFn = jest.fn(() => {
                throw new Error('Sync error');
            });

            // Act & Assert
            expect(() => measureSync('sync-error-operation', errorFn)).toThrow('Sync error');
            
            // Verify metric was still recorded
            const stats = getStats('sync-error-operation');
            expect(stats.count).toBe(1);
        });
    });

    describe('Statistics and Reporting', () => {
        test('should calculate correct statistics', () => {
            // Arrange - Add multiple metrics with known durations
            const durations = [10, 20, 30, 40, 50];
            durations.forEach((duration, index) => {
                performanceMonitor.addMetric({
                    name: 'test-stats',
                    startTime: index * 100,
                    endTime: index * 100 + duration,
                    duration,
                    metadata: {}
                });
            });

            // Act
            const stats = getStats('test-stats');

            // Assert
            expect(stats).toMatchObject({
                name: 'test-stats',
                count: 5,
                min: 10,
                max: 50,
                mean: 30,
                median: 30,
                total: 150
            });
        });

        test('should return null stats for non-existent metric', () => {
            // Act
            const stats = getStats('non-existent');

            // Assert
            expect(stats).toBeNull();
        });

        test('should generate comprehensive report', () => {
            // Arrange
            startTimer('report-test-1');
            endTimer('report-test-1');
            startTimer('report-test-2');
            endTimer('report-test-2');

            // Act
            const report = generateReport();

            // Assert
            expect(report).toHaveProperty('timestamp');
            expect(report).toHaveProperty('memory');
            expect(report).toHaveProperty('metrics');
            expect(report).toHaveProperty('summary');
            
            expect(report.summary.totalMetrics).toBe(2);
            expect(report.summary.uniqueMetrics).toBe(2);
            expect(report.metrics).toHaveProperty('report-test-1');
            expect(report.metrics).toHaveProperty('report-test-2');
        });
    });

    describe('Memory Management', () => {
        test('should prevent memory leaks by limiting metrics', () => {
            // Arrange
            const originalMaxMetrics = performanceMonitor.maxMetrics;
            performanceMonitor.maxMetrics = 5;

            // Act - Add more metrics than the limit
            for (let i = 0; i < 10; i++) {
                performanceMonitor.addMetric({
                    name: `metric-${i}`,
                    startTime: i,
                    endTime: i + 1,
                    duration: 1,
                    metadata: {}
                });
            }

            // Assert
            expect(performanceMonitor.metrics.length).toBe(5);
            
            // Should keep the most recent metrics
            const metricNames = performanceMonitor.metrics.map(m => m.name);
            expect(metricNames).toEqual(['metric-5', 'metric-6', 'metric-7', 'metric-8', 'metric-9']);

            // Restore original limit
            performanceMonitor.maxMetrics = originalMaxMetrics;
        });

        test('should clear all metrics and timers', () => {
            // Arrange
            startTimer('clear-test');
            performanceMonitor.addMetric({
                name: 'test-metric',
                startTime: 0,
                endTime: 10,
                duration: 10,
                metadata: {}
            });

            // Act
            performanceMonitor.clear();

            // Assert
            expect(performanceMonitor.metrics).toHaveLength(0);
            expect(performanceMonitor.activeTimers.size).toBe(0);
        });
    });

    describe('Memory Usage Monitoring', () => {
        test('should return memory usage information', () => {
            // Act
            const memoryUsage = performanceMonitor.getMemoryUsage();

            // Assert
            expect(memoryUsage).toEqual({
                used: 1000000,
                total: 2000000,
                usedPercent: 50
            });
        });

        test('should return null when memory API unavailable', () => {
            // Arrange
            const originalMemory = performance.memory;
            delete performance.memory;

            // Act
            const memoryUsage = performanceMonitor.getMemoryUsage();

            // Assert
            expect(memoryUsage).toBeNull();

            // Restore
            performance.memory = originalMemory;
        });
    });

    describe('Core Web Vitals', () => {
        test('should collect Core Web Vitals', async () => {
            // Arrange
            performance.getEntriesByType.mockImplementation((type) => {
                if (type === 'navigation') {
                    return [{
                        domContentLoadedEventStart: 100,
                        domContentLoadedEventEnd: 200,
                        loadEventStart: 300,
                        loadEventEnd: 400
                    }];
                }
                if (type === 'paint') {
                    return [{
                        name: 'first-contentful-paint',
                        startTime: 150
                    }];
                }
                return [];
            });

            // Act
            const vitals = await performanceMonitor.getCoreWebVitals();

            // Assert
            expect(vitals).toMatchObject({
                domContentLoaded: 100,
                loadComplete: 100,
                FCP: 150
            });
        });
    });

    describe('Enable/Disable Functionality', () => {
        test('should respect enabled/disabled state', () => {
            // Arrange
            performanceMonitor.setEnabled(false);

            // Act
            startTimer('disabled-test');
            const result = measureSync('disabled-sync', () => 'result');

            // Assert
            expect(result).toBe('result');
            expect(performanceMonitor.metrics).toHaveLength(0);
            expect(performanceMonitor.activeTimers.size).toBe(0);

            // Re-enable for other tests
            performanceMonitor.setEnabled(true);
        });
    });

    describe('Export Functionality', () => {
        test('should export metrics as JSON', () => {
            // Arrange
            startTimer('export-test');
            endTimer('export-test');

            // Act
            const exported = performanceMonitor.exportMetrics();
            const parsed = JSON.parse(exported);

            // Assert
            expect(parsed).toHaveProperty('timestamp');
            expect(parsed).toHaveProperty('metrics');
            expect(parsed).toHaveProperty('report');
            expect(parsed.metrics).toHaveLength(1);
            expect(parsed.metrics[0].name).toBe('export-test');
        });
    });

    describe('Performance Monitoring Wrappers', () => {
        test('should wrap Firebase service with monitoring', async () => {
            // Arrange
            const mockFirebaseService = {
                async getTasks() {
                    return ['task1', 'task2'];
                },
                syncMethod() {
                    return 'sync-result';
                }
            };

            const wrappedService = withPerformanceMonitoring.firebase(mockFirebaseService);

            // Act
            const result = await wrappedService.getTasks();

            // Assert
            expect(result).toEqual(['task1', 'task2']);
            
            const stats = getStats('firebase.getTasks');
            expect(stats).toBeDefined();
            expect(stats.count).toBe(1);
        });

        test('should wrap UI controller with monitoring', () => {
            // Arrange
            const mockUIController = {
                updateDisplay() {
                    return 'updated';
                },
                render() {
                    return 'rendered';
                }
            };

            const wrappedController = withPerformanceMonitoring.ui(mockUIController);

            // Act
            const result = wrappedController.updateDisplay();

            // Assert
            expect(result).toBe('updated');
            
            const stats = getStats('ui.updateDisplay');
            expect(stats).toBeDefined();
            expect(stats.count).toBe(1);
        });
    });
});