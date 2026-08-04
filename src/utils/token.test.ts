import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseJwt, isTokenExpired, getTimeUntilExpiration } from './token';

describe('Token Utilities', () => {
	describe('parseJwt', () => {
		it('should parse valid JWT token', () => {
			// Sample JWT: { "sub": "user123", "exp": 1234567890, "iat": 1234567800 }
			const token =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxMjM0NTY3ODkwLCJpYXQiOjEyMzQ1Njc4MDB9.4Adcj0vgGJXcbDqh1SHvKmRBXnJWvXe0O1n5bBYB7VY';

			const payload = parseJwt(token);

			expect(payload.sub).toBe('user123');
			expect(payload.exp).toBe(1234567890);
			expect(payload.iat).toBe(1234567800);
		});

		it('should parse JWT with special characters', () => {
			// Token with special characters in payload
			const token =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

			const payload = parseJwt(token);

			expect(payload.name).toBe('John Doe');
			expect(payload.email).toBe('john@example.com');
			expect(payload.role).toBe('admin');
		});

		it('should handle tokens without expiration', () => {
			// Token without exp claim
			const token =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiaWF0IjoxMjM0NTY3ODAwfQ.NYs_6-8Qy1vX-VLDDRqJKJYMdK5dXqJ3nGe9P3UGD_g';

			const payload = parseJwt(token);

			expect(payload.sub).toBe('user123');
			expect(payload.exp).toBeUndefined();
		});
	});

	describe('isTokenExpired', () => {
		beforeEach(() => {
			// Mock Date.now() to return a fixed timestamp
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should return false for non-expired token', () => {
			// Current time: 2024-01-01 00:00:00 UTC (1704067200000ms)
			vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

			// Token expires in 1 hour: 2024-01-01 01:00:00 UTC (exp: 1704070800)
			const token =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNzA0MDcwODAwfQ.invalid';

			expect(isTokenExpired(token)).toBe(false);
		});

		it('should return true for expired token', () => {
			// Current time: 2024-01-01 02:00:00 UTC (1704074400000ms)
			vi.setSystemTime(new Date('2024-01-01T02:00:00Z'));

			// Token expired 1 hour ago: 2024-01-01 01:00:00 UTC (exp: 1704070800)
			const token =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNzA0MDcwODAwfQ.invalid';

			expect(isTokenExpired(token)).toBe(true);
		});

		it('should return false for token without expiration', () => {
			const token =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIn0.invalid';

			expect(isTokenExpired(token)).toBe(false);
		});

		it('should handle token expiring right now', () => {
			// Current time: 2024-01-01 01:00:00 UTC (1704070800000ms)
			vi.setSystemTime(new Date('2024-01-01T01:00:00Z'));

			// Token expires exactly now (exp: 1704070800)
			const token =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNzA0MDcwODAwfQ.invalid';

			// Should be considered expired if exp <= now
			expect(isTokenExpired(token)).toBe(true);
		});
	});

	describe('getTimeUntilExpiration', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should return time until expiration in milliseconds', () => {
			// Current time: 2024-01-01 00:00:00 UTC (1704067200000ms)
			vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

			// Token expires in 30 minutes: 2024-01-01 00:30:00 UTC (exp: 1704069000)
			const token =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNzA0MDY5MDAwfQ.invalid';

			const timeLeft = getTimeUntilExpiration(token);

			// 30 minutes = 1800000ms
			expect(timeLeft).toBe(1800000);
		});

		it('should return negative value for expired token', () => {
			// Current time: 2024-01-01 02:00:00 UTC (1704074400000ms)
			vi.setSystemTime(new Date('2024-01-01T02:00:00Z'));

			// Token expired 1 hour ago: 2024-01-01 01:00:00 UTC (exp: 1704070800)
			const token =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNzA0MDcwODAwfQ.invalid';

			const timeLeft = getTimeUntilExpiration(token);

			// -1 hour = -3600000ms
			expect(timeLeft).toBe(-3600000);
		});

		it('should return null for token without expiration', () => {
			const token =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIn0.invalid';

			const timeLeft = getTimeUntilExpiration(token);

			expect(timeLeft).toBeNull();
		});

		it('should handle token expiring in 5 minutes (warning threshold)', () => {
			// Current time: 2024-01-01 00:00:00 UTC
			vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

			// Token expires in 5 minutes: 2024-01-01 00:05:00 UTC (exp: 1704067500)
			const token =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNzA0MDY3NTAwfQ.invalid';

			const timeLeft = getTimeUntilExpiration(token);

			// 5 minutes = 300000ms
			expect(timeLeft).toBe(300000);
		});
	});
});
