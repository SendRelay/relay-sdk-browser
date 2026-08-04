import { RelayError } from './RelayError';

/**
 * WebSocket connection error
 *
 * @example
 * ```typescript
 * relay.on('CONNECTION_ERROR', (event) => {
 *   if (event.error instanceof ConnectionError) {
 *     console.error('Connection failed:', event.error.message);
 *     // Show offline UI...
 *   }
 * });
 * ```
 */
export class ConnectionError extends RelayError {
	constructor(message: string, cause?: Error) {
		super(message, cause);
		this.name = 'ConnectionError';
	}

	/**
	 * Returns a JSON representation of the error
	 */
	toJSON(): Record<string, any> {
		return {
			name: this.name,
			message: this.message,
			...(this.cause && { cause: this.cause.message }),
		};
	}
}
