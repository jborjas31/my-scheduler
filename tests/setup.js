// Test setup configuration
// This file sets up the testing environment for the scheduler application

// Mock DOM environment for Node.js testing
const { JSDOM } = require('jsdom');

// Setup DOM
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
    resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;

// Mock Firebase for testing
global.firebase = {
    initializeApp: jest.fn(() => ({})),
    firestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            where: jest.fn(() => ({
                get: jest.fn(() => Promise.resolve({
                    forEach: jest.fn()
                }))
            })),
            add: jest.fn(() => Promise.resolve({ id: 'test-id' })),
            doc: jest.fn(() => ({
                get: jest.fn(() => Promise.resolve({
                    exists: true,
                    data: jest.fn(() => ({ completed: false }))
                })),
                update: jest.fn(() => Promise.resolve()),
                delete: jest.fn(() => Promise.resolve())
            }))
        }))
    }))
};

// Mock console methods for cleaner test output
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
});