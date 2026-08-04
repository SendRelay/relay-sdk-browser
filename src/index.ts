/**
 * Relay SDK for Browsers - Browser SDK
 *
 * Official **client-side** SDK for integrating with the Relay delivery platform from browser applications.
 *
 * **ℹ️ Client-Side SDK:** This SDK uses secure WebSocket tokens (not API keys) for authentication.
 * Tokens must be provisioned by your backend using @relay-sdk/sdk-node (Server SDK).
 *
 * @example Frontend Real-Time Tracking
 * ```typescript
 * import { RelayRealtimeClient } from '@relay-sdk/sdk-browser';
 *
 * // Initialize with token callback (fetches from your backend)
 * const relay = new RelayRealtimeClient({
 *   getToken: async (taskIds) => {
 *     // Your backend generates the token using @relay-sdk/sdk-node
 *     const response = await fetch('/api/relay/token', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ taskIds }),
 *     });
 *     const { token } = await response.json();
 *     return token;
 *   },
 * });
 *
 * // Subscribe to task updates
 * await relay.listen('task-123');
 *
 * relay.on('TASK_ASSIGNED', (event) => {
 *   console.log(`Task assigned to rider ${event.riderId}`);
 * });
 *
 * relay.on('RIDER_LOCATION_UPDATE', (event) => {
 *   updateMapMarker(event.location);
 * });
 * ```
 *
 * @example Backend Token Endpoint (Node.js + Express)
 * ```typescript
 * // Your backend (using @relay-sdk/sdk-node)
 * import { RelayClient } from '@relay-sdk/sdk-node';
 *
 * const relay = new RelayClient({
 *   apiKey: process.env.RELAY_API_KEY, // Server-side only!
 * });
 *
 * app.post('/api/relay/token', authenticateUser, async (req, res) => {
 *   const { taskIds } = req.body;
 *
 *   const { token } = await relay.auth.createWebSocketToken({
 *     taskIds,
 *     type: 'APP',
 *     expiresIn: 3600, // 1 hour
 *   });
 *
 *   res.json({ token });
 * });
 * ```
 *
 * @packageDocumentation
 * @module @relay-sdk/sdk-browser
 */

// Main client
export { RelayRealtimeClient } from './client';
export type { RelayRealtimeClientOptions } from './client';
export {
	buildRelayWebSocketUrl,
	RELAY_DEFAULT_WEBSOCKET_PATH,
	RELAY_DEFAULT_WEBSOCKET_URL,
} from './connection/websocket_url';

// Error classes
export { RelayError, ConnectionError, TokenError } from './errors';

// Types
export type {
	// Event types
	EventType,
	EventHandler,
	EventPayloadMap,
	// Task events
	TaskCreatedEvent,
	TaskOfferedEvent,
	TaskAssignedEvent,
	TaskInProgressEvent,
	TaskCompletedEvent,
	TaskFailedEvent,
	TaskCancelledEvent,
	StageCompletedEvent,
	// Payment events
	PaymentPendingEvent,
	PaymentReleasedEvent,
	PaymentDisputedEvent,
	PaymentDisputeResolvedEvent,
	// Real-time events
	RiderLocationUpdateEvent,
	NewTaskOfferEvent,
	// Connection events
	ConnectionOpenEvent,
	ConnectionCloseEvent,
	ConnectionErrorEvent,
	ConnectionReconnectingEvent,
	TokenExpiringEvent,
	// Common types
	ConnectionState,
	Subscription,
	SubscriptionType,
	Location,
} from './types';
