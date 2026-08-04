/**
 * Subscription manager for WebSocket subscriptions
 *
 * @module subscription/manager
 */

import type { EventEmitter } from '../events/emitter';
import type { Subscription, SubscriptionType } from '../types';

/**
 * Manages WebSocket subscriptions
 *
 * Tracks active subscriptions and handles resubscription after reconnection.
 */
export class SubscriptionManager {
	private subscriptions: Map<string, Subscription> = new Map();

	constructor(private readonly events: EventEmitter) {}

	/**
	 * Add a subscription
	 *
	 * @param type - Subscription type ('task' or 'rider')
	 * @param id - Resource ID
	 *
	 * @example
	 * ```typescript
	 * manager.add('task', 'task-123');
	 * ```
	 */
	add(type: SubscriptionType, id: string): void {
		const key = `${type}:${id}`;
		this.subscriptions.set(key, { type, id, active: true });
	}

	/**
	 * Remove a subscription
	 *
	 * @param type - Subscription type
	 * @param id - Resource ID
	 *
	 * @example
	 * ```typescript
	 * manager.remove('task', 'task-123');
	 * ```
	 */
	remove(type: SubscriptionType, id: string): void {
		const key = `${type}:${id}`;
		this.subscriptions.delete(key);
	}

	/**
	 * Check if subscription exists
	 *
	 * @param type - Subscription type
	 * @param id - Resource ID
	 * @returns True if subscribed
	 *
	 * @example
	 * ```typescript
	 * if (manager.has('task', 'task-123')) {
	 *   console.log('Already subscribed to task-123');
	 * }
	 * ```
	 */
	has(type: SubscriptionType, id: string): boolean {
		const key = `${type}:${id}`;
		return this.subscriptions.has(key);
	}

	/**
	 * Clear all subscriptions
	 *
	 * @example
	 * ```typescript
	 * manager.clear();
	 * ```
	 */
	clear(): void {
		this.subscriptions.clear();
	}

	/**
	 * Resubscribe to all active subscriptions
	 *
	 * Called after WebSocket reconnection to restore subscriptions.
	 *
	 * @example
	 * ```typescript
	 * // After reconnection
	 * await manager.resubscribeAll();
	 * ```
	 */
	async resubscribeAll(): Promise<void> {
		const subs = Array.from(this.subscriptions.values());

		for (const sub of subs) {
			// Emit event to trigger resubscription
			this.events.emit('CONNECTION_OPEN', {
				state: 'connected',
			});
		}
	}

	/**
	 * Get all subscriptions
	 *
	 * @returns Array of subscriptions
	 *
	 * @example
	 * ```typescript
	 * const subs = manager.getAll();
	 * console.log(`${subs.length} active subscriptions`);
	 * ```
	 */
	getAll(): Subscription[] {
		return Array.from(this.subscriptions.values());
	}

	/**
	 * Get subscription count
	 *
	 * @returns Number of subscriptions
	 *
	 * @example
	 * ```typescript
	 * console.log(`${manager.count} subscriptions`);
	 * ```
	 */
	get count(): number {
		return this.subscriptions.size;
	}
}
