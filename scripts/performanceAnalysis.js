#!/usr/bin/env node

// Performance analysis script for the scheduler application
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Mock performance data for analysis
 * In a real scenario, this would be loaded from actual performance logs
 */
const mockPerformanceData = {
    timestamp: new Date().toISOString(),
    metrics: [
        { name: 'app-initialization', duration: 245, metadata: { type: 'startup' } },
        { name: 'firebase-initialization', duration: 89, metadata: { type: 'startup' } },
        { name: 'ui-initialization', duration: 67, metadata: { type: 'startup' } },
        { name: 'initial-task-load', duration: 123, metadata: { type: 'data-load' } },
        { name: 'load-tasks', duration: 78, metadata: { type: 'data-load' } },
        { name: 'load-tasks', duration: 45, metadata: { type: 'data-load', cached: true } },
        { name: 'load-tasks', duration: 92, metadata: { type: 'data-load' } },
        { name: 'ui.updateScheduleDisplay', duration: 34, metadata: { type: 'render' } },
        { name: 'ui.updateTaskDashboard', duration: 28, metadata: { type: 'render' } },
        { name: 'firebase.getTasksForDate', duration: 67, metadata: { type: 'api' } },
        { name: 'firebase.addTask', duration: 156, metadata: { type: 'api' } },
        { name: 'firebase.updateTask', duration: 134, metadata: { type: 'api' } }
    ],
    memory: {
        used: 15420000,
        total: 32768000,
        usedPercent: 47.05
    }
};

/**
 * Analyze performance metrics and generate insights
 * @param {Object} data - Performance data
 * @returns {Object} Analysis results
 */
function analyzePerformance(data) {
    const metrics = data.metrics || [];
    const analysis = {
        summary: {
            totalMetrics: metrics.length,
            timespan: {
                start: Math.min(...metrics.map(m => m.startTime || 0)),
                end: Math.max(...metrics.map(m => m.endTime || 0))
            }
        },
        categories: {},
        recommendations: [],
        issues: []
    };

    // Group metrics by type
    const metricsByType = {};
    const metricsByName = {};

    metrics.forEach(metric => {
        const type = metric.metadata?.type || 'unknown';
        if (!metricsByType[type]) metricsByType[type] = [];
        metricsByType[type].push(metric);

        if (!metricsByName[metric.name]) metricsByName[metric.name] = [];
        metricsByName[metric.name].push(metric);
    });

    // Analyze each category
    Object.entries(metricsByType).forEach(([type, typeMetrics]) => {
        const durations = typeMetrics.map(m => m.duration);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        const minDuration = Math.min(...durations);

        analysis.categories[type] = {
            count: typeMetrics.length,
            avgDuration: Math.round(avgDuration * 100) / 100,
            maxDuration,
            minDuration,
            totalTime: durations.reduce((a, b) => a + b, 0)
        };

        // Performance thresholds and recommendations
        const thresholds = {
            startup: 200,
            'data-load': 100,
            render: 50,
            api: 150
        };

        const threshold = thresholds[type] || 100;

        if (avgDuration > threshold) {
            analysis.issues.push({
                category: type,
                severity: avgDuration > threshold * 2 ? 'high' : 'medium',
                message: `${type} operations averaging ${avgDuration.toFixed(1)}ms (threshold: ${threshold}ms)`,
                avgDuration,
                threshold
            });
        }

        if (maxDuration > threshold * 3) {
            analysis.issues.push({
                category: type,
                severity: 'high',
                message: `Slow ${type} operation detected: ${maxDuration}ms`,
                maxDuration,
                threshold: threshold * 3
            });
        }
    });

    // Analyze specific metrics
    Object.entries(metricsByName).forEach(([name, nameMetrics]) => {
        if (nameMetrics.length > 1) {
            const durations = nameMetrics.map(m => m.duration);
            const variance = calculateVariance(durations);
            const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
            
            if (variance > avgDuration * 0.5) {
                analysis.issues.push({
                    category: 'consistency',
                    severity: 'medium',
                    message: `High variance in ${name}: ${variance.toFixed(1)}ms variance`,
                    metric: name,
                    variance,
                    avgDuration
                });
            }
        }
    });

    // Memory analysis
    if (data.memory) {
        if (data.memory.usedPercent > 80) {
            analysis.issues.push({
                category: 'memory',
                severity: 'high',
                message: `High memory usage: ${data.memory.usedPercent}%`,
                memoryUsage: data.memory
            });
        } else if (data.memory.usedPercent > 60) {
            analysis.issues.push({
                category: 'memory',
                severity: 'medium',
                message: `Moderate memory usage: ${data.memory.usedPercent}%`,
                memoryUsage: data.memory
            });
        }
    }

    // Generate recommendations
    analysis.recommendations = generateRecommendations(analysis);

    return analysis;
}

/**
 * Calculate variance of an array of numbers
 * @param {number[]} numbers - Array of numbers
 * @returns {number} Variance
 */
function calculateVariance(numbers) {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length);
}

/**
 * Generate performance recommendations
 * @param {Object} analysis - Analysis results
 * @returns {string[]} Array of recommendations
 */
function generateRecommendations(analysis) {
    const recommendations = [];

    // Check startup performance
    const startup = analysis.categories.startup;
    if (startup && startup.avgDuration > 200) {
        recommendations.push(
            '🚀 Optimize app startup: Consider code splitting and lazy loading for non-critical components'
        );
    }

    // Check data loading performance
    const dataLoad = analysis.categories['data-load'];
    if (dataLoad && dataLoad.avgDuration > 100) {
        recommendations.push(
            '📊 Optimize data loading: Implement caching strategies and consider pagination for large datasets'
        );
    }

    // Check rendering performance
    const render = analysis.categories.render;
    if (render && render.avgDuration > 50) {
        recommendations.push(
            '🎨 Optimize rendering: Consider virtual scrolling or memoization for complex UI updates'
        );
    }

    // Check API performance
    const api = analysis.categories.api;
    if (api && api.avgDuration > 150) {
        recommendations.push(
            '🌐 Optimize API calls: Review Firebase queries and consider implementing request batching'
        );
    }

    // Check for high variance
    const consistencyIssues = analysis.issues.filter(issue => issue.category === 'consistency');
    if (consistencyIssues.length > 0) {
        recommendations.push(
            '⚡ Improve performance consistency: Investigate variable performance in critical operations'
        );
    }

    // Memory recommendations
    const memoryIssues = analysis.issues.filter(issue => issue.category === 'memory');
    if (memoryIssues.length > 0) {
        recommendations.push(
            '🧠 Optimize memory usage: Review cache sizes and consider implementing memory cleanup strategies'
        );
    }

    // Cache recommendations
    const cacheHits = analysis.categories['data-load']?.count || 0;
    if (cacheHits > 0) {
        recommendations.push(
            '💾 Cache performance looks good: Continue monitoring cache hit rates'
        );
    }

    if (recommendations.length === 0) {
        recommendations.push('✅ Performance looks good! Keep monitoring for any regressions.');
    }

    return recommendations;
}

/**
 * Format analysis results for display
 * @param {Object} analysis - Analysis results
 * @returns {string} Formatted report
 */
function formatReport(analysis) {
    let report = '\n';
    report += '🚀 Performance Analysis Report\n';
    report += '================================\n\n';

    // Summary
    report += `📊 Summary:\n`;
    report += `   Total metrics: ${analysis.summary.totalMetrics}\n\n`;

    // Categories
    report += '📈 Performance by Category:\n';
    Object.entries(analysis.categories).forEach(([category, stats]) => {
        const status = stats.avgDuration > 100 ? '⚠️' : '✅';
        report += `   ${status} ${category.toUpperCase()}: ${stats.avgDuration}ms avg (${stats.count} operations)\n`;
        report += `      Min: ${stats.minDuration}ms | Max: ${stats.maxDuration}ms | Total: ${stats.totalTime}ms\n\n`;
    });

    // Issues
    if (analysis.issues.length > 0) {
        report += '⚠️  Performance Issues:\n';
        analysis.issues.forEach(issue => {
            const severity = issue.severity === 'high' ? '🔴' : '🟡';
            report += `   ${severity} ${issue.message}\n`;
        });
        report += '\n';
    }

    // Recommendations
    report += '💡 Recommendations:\n';
    analysis.recommendations.forEach(rec => {
        report += `   ${rec}\n`;
    });
    report += '\n';

    return report;
}

/**
 * Main analysis function
 */
async function main() {
    console.log('🔍 Starting performance analysis...\n');

    try {
        let performanceData = mockPerformanceData;

        // Try to load real performance data if available
        const dataPath = path.join(process.cwd(), 'performance-data.json');
        if (existsSync(dataPath)) {
            const data = await readFile(dataPath, 'utf8');
            performanceData = JSON.parse(data);
            console.log('📂 Loaded performance data from file');
        } else {
            console.log('📊 Using mock performance data for analysis');
        }

        // Perform analysis
        const analysis = analyzePerformance(performanceData);
        
        // Generate and display report
        const report = formatReport(analysis);
        console.log(report);

        // Save detailed analysis
        const outputPath = path.join(process.cwd(), 'performance-analysis.json');
        await writeFile(outputPath, JSON.stringify(analysis, null, 2));
        console.log(`💾 Detailed analysis saved to: ${outputPath}`);

        // Exit with appropriate code
        const hasHighSeverityIssues = analysis.issues.some(issue => issue.severity === 'high');
        process.exit(hasHighSeverityIssues ? 1 : 0);

    } catch (error) {
        console.error('❌ Performance analysis failed:', error);
        process.exit(1);
    }
}

// Run analysis if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { analyzePerformance, formatReport, generateRecommendations };