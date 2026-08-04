/**
 * Common types for the Relay browser SDK
 *
 * @module types/common
 */

/**
 * WebSocket connection state
 */
export type ConnectionState =
	| 'connecting'
	| 'connected'
	| 'disconnecting'
	| 'disconnected'
	| 'reconnecting';

/**
 * Subscription type
 */
export type SubscriptionType = 'task' | 'rider';

/**
 * Subscription options
 */
export interface SubscriptionOptions {
	/** Additional metadata (optional) */
	metadata?: Record<string, any>;
}

/**
 * Subscription information
 */
export interface Subscription {
	type: SubscriptionType;
	id: string;
	active: boolean;
}
