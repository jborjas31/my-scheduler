// Tests for task validation functions
import { 
    validateTaskName, 
    validateTaskTimes, 
    validatePriority,
    checkForOverlaps 
} from '../../src/js/utils/taskValidation.js';

describe('Task Validation', () => {
    describe('validateTaskName', () => {
        test('accepts valid task name', () => {
            const result = validateTaskName('Valid Task Name');
            expect(result).toBe('Valid Task Name');
        });

        test('trims whitespace', () => {
            const result = validateTaskName('  Trimmed Name  ');
            expect(result).toBe('Trimmed Name');
        });

        test('throws error for empty name', () => {
            expect(() => validateTaskName('')).toThrow('Please enter a task name');
        });

        test('throws error for only whitespace', () => {
            expect(() => validateTaskName('   ')).toThrow('Task name cannot be empty after cleaning');
        });

        test('throws error for too long name', () => {
            const longName = 'a'.repeat(101);
            expect(() => validateTaskName(longName)).toThrow('Task name is too long');
        });

        test('throws error for name without letters or numbers', () => {
            expect(() => validateTaskName('!@#$%')).toThrow('must contain at least some letters or numbers');
        });

        test('removes invisible characters', () => {
            const nameWithInvisible = 'Task\u200BName';
            const result = validateTaskName(nameWithInvisible);
            expect(result).toBe('TaskName');
        });
    });

    describe('validateTaskTimes', () => {
        test('validates normal time range', () => {
            const result = validateTaskTimes(540, 600); // 9:00 AM - 10:00 AM
            expect(result.isValid).toBe(true);
            expect(result.startMinutes).toBe(540);
            expect(result.endMinutes).toBe(600);
            expect(result.durationMinutes).toBe(60);
            expect(result.crossesMidnight).toBe(false);
        });

        test('validates cross-midnight time range', () => {
            const result = validateTaskTimes(1380, 60); // 11:00 PM - 1:00 AM
            expect(result.isValid).toBe(true);
            expect(result.crossesMidnight).toBe(true);
            expect(result.durationMinutes).toBe(120); // 1 hour + 1 hour = 2 hours
        });

        test('rejects task shorter than minimum duration', () => {
            const result = validateTaskTimes(540, 542); // 2-minute task
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('shorter than 5 minutes');
        });

        test('rejects task longer than maximum duration', () => {
            const result = validateTaskTimes(0, 1200); // 20-hour task
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('longer than 18 hours');
        });

        test('provides duration text', () => {
            const result = validateTaskTimes(540, 630); // 1.5 hour task
            expect(result.durationText).toBe('1h 30m');
        });
    });

    describe('validatePriority', () => {
        test('accepts fixed priority', () => {
            const result = validatePriority('fixed');
            expect(result).toBe('fixed');
        });

        test('accepts flexible priority', () => {
            const result = validatePriority('flexible');
            expect(result).toBe('flexible');
        });

        test('throws error for invalid priority', () => {
            expect(() => validatePriority('invalid')).toThrow('Please select a valid task priority');
        });

        test('throws error for empty priority', () => {
            expect(() => validatePriority('')).toThrow('Please select a valid task priority');
        });
    });

    describe('checkForOverlaps', () => {
        const existingTasks = [
            {
                id: '1',
                startTime: 540, // 9:00 AM
                endTime: 600,   // 10:00 AM
                crossesMidnight: false
            },
            {
                id: '2', 
                startTime: 720, // 12:00 PM
                endTime: 780,   // 1:00 PM
                crossesMidnight: false
            }
        ];

        test('detects overlap with existing task', () => {
            const overlaps = checkForOverlaps(570, 630, existingTasks, false); // 9:30 AM - 10:30 AM
            expect(overlaps).toHaveLength(1);
            expect(overlaps[0].id).toBe('1');
        });

        test('detects no overlap when clear', () => {
            const overlaps = checkForOverlaps(660, 720, existingTasks, false); // 11:00 AM - 12:00 PM
            expect(overlaps).toHaveLength(0);
        });

        test('handles cross-midnight overlaps', () => {
            const crossMidnightTask = [{
                id: '3',
                startTime: 1380, // 11:00 PM
                endTime: 60,     // 1:00 AM
                crossesMidnight: true
            }];

            // Task that overlaps after midnight
            const overlaps = checkForOverlaps(30, 90, crossMidnightTask, false); // 12:30 AM - 1:30 AM
            expect(overlaps).toHaveLength(1);
        });
    });
});