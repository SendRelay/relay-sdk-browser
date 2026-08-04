import { RelayError } from './RelayError';

/**
 * JWT token error (expired, invalid, etc.)
 *
 * @example
 * ```typescript
 * try {
 *   const relay = new RelayRealtimeClient({ token: expiredToken });
 * } catch (error) {
 *   if (error instanceof TokenError) {
 *     console.error('Token error:', error.message);
 *     // Refresh token from backend...
 *   }
 * }
 * ```
 */
export class TokenError extends RelayError {
	constructor(message: string) {
		super(message);
		this.name = 'TokenError';
	}

	/**
	 * Returns a JSON representation of the error
	 */
	toJSON(): Record<string, any> {
		return {
			name: this.name,
			message: this.message,
		};
	}
}
