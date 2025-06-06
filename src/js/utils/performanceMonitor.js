// Performance monitoring utilities for the scheduler application

/**
 * @typedef {Object} PerformanceMetric
 * @property {string} name - Metric name
 * @property {number} startTime - Start timestamp
 * @property {number} endTime - End timestamp
 * @property {number} duration - Duration in milliseconds
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} MemoryUsage
 * @property {number} used - Used memory in bytes
 * @property {number} total - Total memory in bytes
 * @property {number} usedPercent - Used memory percentage
 */

/**
 * Performance monitoring service
 */
class PerformanceMonitor {
    constructor() {
        /** @type {Map<string, number>} */
        this.activeTimers = new Map();
        
        /** @type {PerformanceMetric[]} */
        this.metrics = [];
        
        /** @type {boolean} */
        this.isEnabled = true;
        
        /** @type {number} */
        this.maxMetrics = 1000; // Prevent memory leaks
        
        this.setupPerformanceObservers();
    }

    /**
     * Start timing a performance metric
     * @param {string} name - Metric name
     * @param {Object} metadata - Additional metadata
     */
    startTimer(name, metadata = {}) {
        if (!this.isEnabled) return;
        
        const startTime = performance.now();
        this.activeTimers.set(name, startTime);
        
        // Store metadata for when we end the timer
        this.activeTimers.set(`${name}_metadata`, metadata);
    }

    /**
     * End timing a performance metric
     * @param {string} name - Metric name
     * @returns {PerformanceMetric|null} The completed metric
     */
    endTimer(name) {
        if (!this.isEnabled) return null;
        
        const endTime = performance.now();
        const startTime = this.activeTimers.get(name);
        
        if (!startTime) {
            console.warn(`Performance timer '${name}' was not started`);
            return null;
        }
        
        const metadata = this.activeTimers.get(`${name}_metadata`) || {};
        const duration = endTime - startTime;
        
        const metric = {
            name,
            startTime,
            endTime,
            duration,
            metadata
        };
        
        this.addMetric(metric);
        
        // Clean up
        this.activeTimers.delete(name);
        this.activeTimers.delete(`${name}_metadata`);
        
        return metric;
    }

    /**
     * Measure the execution time of a function
     * @param {string} name - Metric name
     * @param {Function} fn - Function to measure
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<any>} Function result
     */
    async measure(name, fn, metadata = {}) {
        if (!this.isEnabled) {
            return await fn();
        }
        
        this.startTimer(name, metadata);
        
        try {
            const result = await fn();
            this.endTimer(name);
            return result;
        } catch (error) {
            this.endTimer(name);
            throw error;
        }
    }

    /**
     * Measure sync function execution time
     * @param {string} name - Metric name
     * @param {Function} fn - Sync function to measure
     * @param {Object} metadata - Additional metadata
     * @returns {any} Function result
     */
    measureSync(name, fn, metadata = {}) {
        if (!this.isEnabled) {
            return fn();
        }
        
        this.startTimer(name, metadata);
        
        try {
            const result = fn();
            this.endTimer(name);
            return result;
        } catch (error) {
            this.endTimer(name);
            throw error;
        }
    }

    /**
     * Add a performance metric
     * @param {PerformanceMetric} metric - Metric to add
     */
    addMetric(metric) {
        this.metrics.push(metric);
        
        // Prevent memory leaks by keeping only recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
    }

    /**
     * Get performance metrics by name
     * @param {string} name - Metric name
     * @returns {PerformanceMetric[]} Matching metrics
     */
    getMetrics(name) {
        return this.metrics.filter(metric => metric.name === name);
    }

    /**
     * Get performance statistics for a metric
     * @param {string} name - Metric name
     * @returns {Object} Statistics object
     */
    getStats(name) {
        const metrics = this.getMetrics(name);
        
        if (metrics.length === 0) {
            return null;
        }
        
        const durations = metrics.map(m => m.duration);
        durations.sort((a, b) => a - b);
        
        const sum = durations.reduce((acc, d) => acc + d, 0);
        const mean = sum / durations.length;
        
        const median = durations.length % 2 === 0
            ? (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2
            : durations[Math.floor(durations.length / 2)];
        
        return {
            name,
            count: metrics.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
            mean: Number(mean.toFixed(2)),
            median: Number(median.toFixed(2)),
            p95: Number(durations[Math.floor(durations.length * 0.95)].toFixed(2)),
            p99: Number(durations[Math.floor(durations.length * 0.99)].toFixed(2)),
            total: Number(sum.toFixed(2))
        };
    }

    /**
     * Get memory usage information
     * @returns {MemoryUsage|null} Memory usage stats
     */
    getMemoryUsage() {
        if (!performance.memory) {
            return null;
        }
        
        const used = performance.memory.usedJSHeapSize;
        const total = performance.memory.totalJSHeapSize;
        
        return {
            used,
            total,
            usedPercent: Number(((used / total) * 100).toFixed(2))
        };
    }

    /**
     * Get Core Web Vitals
     * @returns {Promise<Object>} Core Web Vitals metrics
     */
    async getCoreWebVitals() {
        return new Promise((resolve) => {
            const vitals = {
                FCP: null,  // First Contentful Paint
                LCP: null,  // Largest Contentful Paint
                FID: null,  // First Input Delay
                CLS: null   // Cumulative Layout Shift
            };
            
            // Get navigation timing
            const navigation = performance.getEntriesByType('navigation')[0];
            if (navigation) {
                vitals.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
                vitals.loadComplete = navigation.loadEventEnd - navigation.loadEventStart;
            }
            
            // Try to get paint timing
            const paintEntries = performance.getEntriesByType('paint');
            paintEntries.forEach(entry => {
                if (entry.name === 'first-contentful-paint') {
                    vitals.FCP = entry.startTime;
                }
            });
            
            resolve(vitals);
        });
    }

    /**
     * Setup performance observers
     */
    setupPerformanceObservers() {
        if (!window.PerformanceObserver) {
            return;
        }
        
        try {
            // Observe long tasks (performance bottlenecks)
            const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    this.addMetric({
                        name: 'long-task',
                        startTime: entry.startTime,
                        endTime: entry.startTime + entry.duration,
                        duration: entry.duration,
                        metadata: {
                            type: 'performance-bottleneck'
                        }
                    });
                });
            });
            
            longTaskObserver.observe({ entryTypes: ['longtask'] });
            
            // Observe layout shifts
            const layoutShiftObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    this.addMetric({
                        name: 'layout-shift',
                        startTime: entry.startTime,
                        endTime: entry.startTime,
                        duration: 0,
                        metadata: {
                            value: entry.value,
                            hadRecentInput: entry.hadRecentInput
                        }
                    });
                });
            });
            
            layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
            
        } catch (error) {
            console.warn('Performance observers not supported:', error);
        }
    }

    /**
     * Generate performance report
     * @returns {Object} Performance report
     */
    generateReport() {
        // Use a more lightweight report for better performance
        const report = {
            memory: this.getMemoryUsage(),
            metrics: {}
        };
        
        // Only include detailed metrics in development
        if (window.location.hostname === 'localhost') {
            report.timestamp = new Date().toISOString();
            report.summary = {
                totalMetrics: this.metrics.length,
                uniqueMetrics: new Set(this.metrics.map(m => m.name)).size
            };
            
            // Get stats for key metrics only
            const keyMetrics = ['app-initialization', 'firebase-initialization', 'ui-initialization', 'load-tasks'];
            keyMetrics.forEach(name => {
                const stats = this.getStats(name);
                if (stats.count > 0) {
                    report.metrics[name] = stats;
                }
            });
        }
        
        return report;
    }

    /**
     * Clear all metrics
     */
    clear() {
        this.metrics = [];
        this.activeTimers.clear();
    }

    /**
     * Enable/disable performance monitoring
     * @param {boolean} enabled - Whether to enable monitoring
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        if (!enabled) {
            this.activeTimers.clear();
        }
    }

    /**
     * Export metrics as JSON
     * @returns {string} JSON string of metrics
     */
    exportMetrics() {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            report: this.generateReport()
        }, null, 2);
    }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions for common operations
export const startTimer = (name, metadata) => performanceMonitor.startTimer(name, metadata);
export const endTimer = (name) => performanceMonitor.endTimer(name);
export const measure = (name, fn, metadata) => performanceMonitor.measure(name, fn, metadata);
export const measureSync = (name, fn, metadata) => performanceMonitor.measureSync(name, fn, metadata);
export const getStats = (name) => performanceMonitor.getStats(name);
export const generateReport = () => performanceMonitor.generateReport();

// Auto-measure common operations
export const withPerformanceMonitoring = {
    /**
     * Wrap Firebase operations with performance monitoring
     * @param {Object} firebaseService - Firebase service instance
     * @returns {Object} Wrapped service
     */
    firebase: (firebaseService) => {
        return new Proxy(firebaseService, {
            get(target, prop) {
                if (typeof target[prop] === 'function') {
                    return async (...args) => {
                        return await measure(`firebase.${prop}`, () => target[prop](...args));
                    };
                }
                return target[prop];
            }
        });
    },
    
    /**
     * Wrap UI operations with performance monitoring
     * @param {Object} uiController - UI controller instance
     * @returns {Object} Wrapped controller
     */
    ui: (uiController) => {
        return new Proxy(uiController, {
            get(target, prop) {
                if (typeof target[prop] === 'function') {
                    return (...args) => {
                        return measureSync(`ui.${prop}`, () => target[prop](...args));
                    };
                }
                return target[prop];
            }
        });
    }
};