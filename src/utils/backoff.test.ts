import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateBackoff } from './backoff';

describe('calculateBackoff', () => {
	beforeEach(() => {
		vi.spyOn(Math, 'random').mockReturnValue(0.5);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should calculate exponential backoff correctly', () => {
		const initialDelay = 1000;
		const maxDelay = 30000;
		const multiplier = 1.5;

		// Attempt 0: 1000ms
		const delay0 = calculateBackoff(0, initialDelay, maxDelay, multiplier);
		expect(delay0).toBe(1000);

		// Attempt 1: 1000 * 1.5 = 1500ms
		const delay1 = calculateBackoff(1, initialDelay, maxDelay, multiplier);
		expect(delay1).toBe(1500);

		// Attempt 2: 1000 * 1.5^2 = 2250ms
		const delay2 = calculateBackoff(2, initialDelay, maxDelay, multiplier);
		expect(delay2).toBe(2250);

		// Attempt 3: 1000 * 1.5^3 = 3375ms
		const delay3 = calculateBackoff(3, initialDelay, maxDelay, multiplier);
		expect(delay3).toBe(3375);
	});

	it('should cap delay at maxDelay', () => {
		const initialDelay = 1000;
		const maxDelay = 5000;
		const multiplier = 2;

		// Attempt 10: 1000 * 2^10 = 1,024,000ms (would exceed maxDelay)
		const delay10 = calculateBackoff(10, initialDelay, maxDelay, multiplier);
		expect(delay10).toBe(maxDelay);
	});

	it('should handle attempt 0 correctly', () => {
		const delay = calculateBackoff(0, 2000, 10000, 1.5);
		expect(delay).toBe(2000);
	});

	it('should handle different multipliers', () => {
		// Multiplier 2.0 (doubles each time)
		expect(calculateBackoff(0, 1000, 100000, 2.0)).toBe(1000);
		expect(calculateBackoff(1, 1000, 100000, 2.0)).toBe(2000);
		expect(calculateBackoff(2, 1000, 100000, 2.0)).toBe(4000);
		expect(calculateBackoff(3, 1000, 100000, 2.0)).toBe(8000);

		// Multiplier 1.2 (slower growth)
		expect(calculateBackoff(0, 1000, 100000, 1.2)).toBe(1000);
		expect(calculateBackoff(1, 1000, 100000, 1.2)).toBe(1200);
		expect(calculateBackoff(2, 1000, 100000, 1.2)).toBe(1440);
	});

	it('should return initialDelay when multiplier is 1', () => {
		const initialDelay = 5000;
		expect(calculateBackoff(0, initialDelay, 10000, 1)).toBe(initialDelay);
		expect(calculateBackoff(5, initialDelay, 10000, 1)).toBe(initialDelay);
		expect(calculateBackoff(100, initialDelay, 10000, 1)).toBe(initialDelay);
	});
});
