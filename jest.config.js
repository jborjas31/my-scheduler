// Jest configuration for the scheduler application
export default {
    // Test environment
    testEnvironment: 'jsdom',
    
    // Setup files to run before tests
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    
    // Test file patterns
    testMatch: [
        '<rootDir>/tests/**/*.test.js'
    ],
    
    // Project configuration for different test types
    projects: [
        {
            displayName: 'unit',
            testMatch: ['<rootDir>/tests/utils/**/*.test.js'],
            testEnvironment: 'jsdom'
        },
        {
            displayName: 'integration',
            testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
            testEnvironment: 'jsdom',
            setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
        }
    ],
    
    // Module file extensions
    moduleFileExtensions: ['js', 'json'],
    
    // Transform files
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    
    // Module name mapping for CSS imports
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
    },
    
    // Coverage configuration
    collectCoverageFrom: [
        'src/js/**/*.js',
        '!src/js/**/*.test.js',
        '!src/js/main.js' // Exclude main entry point from coverage
    ],
    
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Verbose output
    verbose: true,
    
    // Error handling
    errorOnDeprecated: true
};