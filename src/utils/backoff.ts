/**
 * Exponential backoff calculator with jitter
 *
 * @module utils/backoff
 */

/**
 * Calculate exponential backoff delay with jitter
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param initialDelayMs - Initial delay in milliseconds
 * @param maxDelayMs - Maximum delay in milliseconds
 * @param multiplier - Backoff multiplier
 * @returns Delay in milliseconds
 *
 * @example
 * ```typescript
 * const delay = calculateBackoff(0, 1000, 30000, 1.5);
 * // First attempt: ~1000ms (with jitter)
 *
 * const delay2 = calculateBackoff(3, 1000, 30000, 1.5);
 * // Fourth attempt: ~3375ms (with jitter)
 * ```
 */
export function calculateBackoff(
	attempt: number,
	initialDelayMs: number,
	maxDelayMs: number,
	multiplier: number
): number {
	// Calculate base delay with exponential backoff
	const delay = Math.min(
		initialDelayMs * Math.pow(multiplier, attempt),
		maxDelayMs
	);

	// Add jitter (±25% randomization to prevent thundering herd)
	const jitter = delay * 0.25 * (Math.random() * 2 - 1);

	return Math.floor(delay + jitter);
}
