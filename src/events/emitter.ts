/**
 * Event emitter for the Relay browser SDK
 *
 * @module events/emitter
 */

import type { EventType, EventHandler } from '../types';

/**
 * Type-safe event emitter
 *
 * Provides event subscription and emission with full TypeScript type safety.
 */
export class EventEmitter {
	private listeners: Map<EventType, Set<EventHandler>> = new Map();

	/**
	 * Subscribe to an event
	 *
	 * @param event - Event type to listen for
	 * @param handler - Event handler function
	 * @returns Cleanup function to remove the listener
	 *
	 * @example
	 * ```typescript
	 * const unsubscribe = emitter.on('TASK_ASSIGNED', (event) => {
	 *   console.log('Task assigned:', event.taskId);
	 * });
	 *
	 * // Later: remove listener
	 * unsubscribe();
	 * ```
	 */
	on<T extends EventType>(event: T, handler: EventHandler<T>): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}

		this.listeners.get(event)!.add(handler as EventHandler);

		// Return cleanup function
		return () => this.off(event, handler);
	}

	/**
	 * Subscribe to an event once
	 *
	 * Handler is automatically removed after first invocation.
	 *
	 * @param event - Event type to listen for
	 * @param handler - Event handler function
	 *
	 * @example
	 * ```typescript
	 * emitter.once('TASK_COMPLETED', (event) => {
	 *   console.log('Task completed once:', event.taskId);
	 * });
	 * ```
	 */
	once<T extends EventType>(event: T, handler: EventHandler<T>): void {
		const onceHandler: EventHandler<T> = (payload) => {
			handler(payload);
			this.off(event, onceHandler);
		};

		this.on(event, onceHandler);
	}

	/**
	 * Remove an event listener
	 *
	 * @param event - Event type
	 * @param handler - Event handler to remove
	 *
	 * @example
	 * ```typescript
	 * const handler = (event) => console.log(event);
	 * emitter.on('TASK_ASSIGNED', handler);
	 * emitter.off('TASK_ASSIGNED', handler);
	 * ```
	 */
	off<T extends EventType>(event: T, handler: EventHandler<T>): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			handlers.delete(handler as EventHandler);
			if (handlers.size === 0) {
				this.listeners.delete(event);
			}
		}
	}

	/**
	 * Emit an event to all subscribers
	 *
	 * @param event - Event type
	 * @param payload - Event payload
	 *
	 * @example
	 * ```typescript
	 * emitter.emit('TASK_ASSIGNED', {
	 *   taskId: 'task-123',
	 *   riderId: 'rider-456',
	 *   // ...
	 * });
	 * ```
	 */
	emit<T extends EventType>(event: T, payload: any): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(payload);
				} catch (error) {
					console.error(`Error in event handler for ${event}:`, error);
				}
			});
		}
	}

	/**
	 * Remove all listeners for an event
	 *
	 * @param event - Event type (if omitted, removes all listeners)
	 *
	 * @example
	 * ```typescript
	 * // Remove all TASK_ASSIGNED listeners
	 * emitter.removeAllListeners('TASK_ASSIGNED');
	 *
	 * // Remove ALL listeners
	 * emitter.removeAllListeners();
	 * ```
	 */
	removeAllListeners(event?: EventType): void {
		if (event) {
			this.listeners.delete(event);
		} else {
			this.listeners.clear();
		}
	}

	/**
	 * Get listener count for an event
	 *
	 * @param event - Event type
	 * @returns Number of listeners
	 *
	 * @example
	 * ```typescript
	 * const count = emitter.listenerCount('TASK_ASSIGNED');
	 * console.log(`${count} listeners for TASK_ASSIGNED`);
	 * ```
	 */
	listenerCount(event: EventType): number {
		return this.listeners.get(event)?.size || 0;
	}
}
