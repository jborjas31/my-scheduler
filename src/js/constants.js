// Application constants and configuration

// Firebase configuration
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA0chYZcONeLq57IlskjBJMOx2zFSa8b4k",
    authDomain: "my-scheduler-8c394.firebaseapp.com",
    projectId: "my-scheduler-8c394",
    storageBucket: "my-scheduler-8c394.firebasestorage.app",
    messagingSenderId: "225852937709",
    appId: "1:225852937709:web:58ab245d40ddb19b3c03e4"
};

// Schedule configuration
export const SCHEDULE_CONFIG = {
    START_HOUR: 0,    // 12 AM (midnight)
    END_HOUR: 23,     // 11 PM
    PIXELS_PER_MINUTE: 1
};

// Time picker configuration
export const TIME_PICKER_CONFIG = {
    INTERVAL_MINUTES: 15,
    MAX_DROPDOWN_HEIGHT: 200
};

// Task validation rules
export const TASK_VALIDATION = {
    MAX_NAME_LENGTH: 100,
    MIN_DURATION_MINUTES: 5,
    MAX_DURATION_HOURS: 18,
    MAX_UPCOMING_HOURS: 3
};

// UI configuration
export const UI_CONFIG = {
    ERROR_DISPLAY_DURATION: 5000,
    SUCCESS_DISPLAY_DURATION: 4000,
    SCROLL_THRESHOLD: 200,
    FLOATING_BANNER_THRESHOLD: 200,
    DATE_RANGE_YEARS: 1
};

// CSS class names
export const CSS_CLASSES = {
    TASK_BLOCK: 'task-block',
    TASK_TINY: 'task-tiny',
    TASK_SHORT: 'task-short',
    TASK_MEDIUM: 'task-medium',
    TASK_LONG: 'task-long',
    COMPLETED: 'completed',
    OVERDUE: 'overdue',
    FIXED: 'fixed',
    FLEXIBLE: 'flexible',
    LOADING: 'loading',
    SHOW: 'show'
};

// Priority types
export const PRIORITY_TYPES = {
    FIXED: 'fixed',
    FLEXIBLE: 'flexible'
};

// Task duration thresholds (in minutes)
export const TASK_DURATION_THRESHOLDS = {
    TINY: 30,     // Less than 30 minutes
    SHORT: 60,    // 30-60 minutes  
    MEDIUM: 120   // 1-2 hours
};

// Icon mappings
export const ICONS = {
    PRIORITY_FIXED: '🔒',
    PRIORITY_FLEXIBLE: '⏰',
    COMPLETED: '✅',
    NOT_COMPLETED: '⭕',
    CROSS_MIDNIGHT: '🌙',
    CURRENT_TASK: '🔴',
    UPCOMING_TASK: '⏰',
    OVERDUE_TASK: '⚠️',
    COMPLETED_TASK: '✅'
};

// Default time offsets for time pickers
export const TIME_OFFSETS = {
    START_TIME_DEFAULT: 0,      // Current time
    END_TIME_DEFAULT: 60        // 1 hour after current time
};