// Tests for date utility functions
import { 
    formatDateDisplay, 
    getDateString, 
    formatTimeFromMinutes, 
    formatTimeRange,
    parseManualTime,
    getCurrentTimeMinutes,
    isToday 
} from '../../src/js/utils/dateUtils.js';

describe('Date Utils', () => {
    describe('formatDateDisplay', () => {
        test('formats date correctly', () => {
            const date = new Date('2024-01-15T12:00:00Z');
            const result = formatDateDisplay(date);
            expect(result).toMatch(/Monday.*January.*15.*2024/);
        });
    });

    describe('getDateString', () => {
        test('returns YYYY-MM-DD format', () => {
            const date = new Date('2024-01-15T12:00:00Z');
            const result = getDateString(date);
            expect(result).toBe('2024-01-15');
        });

        test('pads single digits', () => {
            const date = new Date('2024-01-05T12:00:00Z');
            const result = getDateString(date);
            expect(result).toBe('2024-01-05');
        });
    });

    describe('formatTimeFromMinutes', () => {
        test('formats midnight correctly', () => {
            expect(formatTimeFromMinutes(0)).toBe('12:00 AM');
        });

        test('formats noon correctly', () => {
            expect(formatTimeFromMinutes(720)).toBe('12:00 PM');
        });

        test('formats AM times correctly', () => {
            expect(formatTimeFromMinutes(540)).toBe('9:00 AM'); // 9:00 AM
        });

        test('formats PM times correctly', () => {
            expect(formatTimeFromMinutes(810)).toBe('1:30 PM'); // 1:30 PM
        });

        test('formats late night correctly', () => {
            expect(formatTimeFromMinutes(1410)).toBe('11:30 PM'); // 11:30 PM
        });
    });

    describe('formatTimeRange', () => {
        test('formats normal time range', () => {
            const result = formatTimeRange(540, 600); // 9:00 AM - 10:00 AM
            expect(result).toBe('9:00 AM - 10:00 AM');
        });

        test('formats cross-midnight range', () => {
            const result = formatTimeRange(1380, 60); // 11:00 PM - 1:00 AM
            expect(result).toBe('11:00 PM - 1:00 AM (+1 day)');
        });
    });

    describe('parseManualTime', () => {
        test('parses 24-hour format', () => {
            expect(parseManualTime('14:30')).toBe(870); // 14:30 = 870 minutes
        });

        test('parses 12-hour AM format', () => {
            expect(parseManualTime('9:30 AM')).toBe(570); // 9:30 AM = 570 minutes
        });

        test('parses 12-hour PM format', () => {
            expect(parseManualTime('2:30 PM')).toBe(870); // 2:30 PM = 870 minutes
        });

        test('parses midnight correctly', () => {
            expect(parseManualTime('12:00 AM')).toBe(0);
        });

        test('parses noon correctly', () => {
            expect(parseManualTime('12:00 PM')).toBe(720);
        });

        test('throws error for invalid format', () => {
            expect(() => parseManualTime('invalid')).toThrow();
        });

        test('throws error for invalid hour in 24-hour format', () => {
            expect(() => parseManualTime('25:00')).toThrow();
        });

        test('throws error for invalid minute', () => {
            expect(() => parseManualTime('12:60')).toThrow();
        });

        test('returns null for empty input', () => {
            expect(parseManualTime('')).toBeNull();
            expect(parseManualTime(null)).toBeNull();
        });
    });

    describe('isToday', () => {
        test('returns true for today', () => {
            const today = new Date();
            expect(isToday(today)).toBe(true);
        });

        test('returns false for yesterday', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            expect(isToday(yesterday)).toBe(false);
        });

        test('returns false for tomorrow', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            expect(isToday(tomorrow)).toBe(false);
        });
    });

    describe('getCurrentTimeMinutes', () => {
        test('returns number in valid range', () => {
            const result = getCurrentTimeMinutes();
            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThanOrEqual(1440); // 24 * 60 = 1440
        });
    });
});