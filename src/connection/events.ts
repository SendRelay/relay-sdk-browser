/**
 * WebSocket connection-level events
 *
 * These are low-level events emitted by the WebSocketConnection class.
 * They are separate from the high-level Relay events.
 *
 * @module connection/events
 */

/**
 * WebSocket connection event types
 */
export type WebSocketEventType =
	| 'open'
	| 'close'
	| 'error'
	| 'message'
	| 'reconnecting';

/**
 * WebSocket open event payload
 */
export interface WebSocketOpenEvent {
	// Empty payload
}

/**
 * WebSocket close event payload
 */
export interface WebSocketCloseEvent {
	code: number;
	reason: string;
}

/**
 * WebSocket error event payload
 */
export interface WebSocketErrorEvent {
	error: any;
}

/**
 * WebSocket message event payload
 */
export interface WebSocketMessageEvent {
	data: any;
}

/**
 * WebSocket reconnecting event payload
 */
export interface WebSocketReconnectingEvent {
	attempt: number;
	delay: number;
}

/**
 * WebSocket event payload map
 */
export interface WebSocketEventPayloadMap {
	open: WebSocketOpenEvent;
	close: WebSocketCloseEvent;
	error: WebSocketErrorEvent;
	message: WebSocketMessageEvent;
	reconnecting: WebSocketReconnectingEvent;
}

/**
 * WebSocket event handler type
 */
export type WebSocketEventHandler<T extends WebSocketEventType = WebSocketEventType> = (
	payload: WebSocketEventPayloadMap[T]
) => void;

/**
 * Simple event emitter for WebSocket connection events
 */
export class WebSocketEventEmitter {
	private listeners: Map<WebSocketEventType, Set<WebSocketEventHandler>> = new Map();

	/**
	 * Subscribe to an event
	 */
	on<T extends WebSocketEventType>(event: T, handler: WebSocketEventHandler<T>): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}

		this.listeners.get(event)!.add(handler as WebSocketEventHandler);

		// Return cleanup function
		return () => this.off(event, handler);
	}

	/**
	 * Remove an event listener
	 */
	off<T extends WebSocketEventType>(event: T, handler: WebSocketEventHandler<T>): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			handlers.delete(handler as WebSocketEventHandler);
			if (handlers.size === 0) {
				this.listeners.delete(event);
			}
		}
	}

	/**
	 * Emit an event to all subscribers
	 */
	emit<T extends WebSocketEventType>(event: T, payload: WebSocketEventPayloadMap[T]): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(payload);
				} catch (error) {
					console.error(`Error in WebSocket event handler for ${event}:`, error);
				}
			});
		}
	}

	/**
	 * Remove all listeners
	 */
	removeAllListeners(event?: WebSocketEventType): void {
		if (event) {
			this.listeners.delete(event);
		} else {
			this.listeners.clear();
		}
	}
}
