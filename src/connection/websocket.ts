/**
 * WebSocket connection manager with automatic reconnection
 *
 * @module connection/websocket
 */

import { WebSocketEventEmitter } from './events';
import { ConnectionError } from '../errors';
import { calculateBackoff } from '../utils/backoff';
import { isTokenExpired } from '../utils/token';
import { HeartbeatManager } from './heartbeat';
import { MessageQueue } from './queue';
import type { ConnectionState } from '../types';
import { buildRelayWebSocketUrl } from './websocket_url';

/**
 * WebSocket connection configuration
 */
export interface WebSocketConnectionOptions {
	/** WebSocket URL */
	url: string;
	/** JWT token (optional - can be set later with setToken()) */
	token?: string;
	/** Device ID (optional) */
	deviceId?: string;
	/** Reconnection configuration */
	reconnect: {
		enabled: boolean;
		maxAttempts: number;
		initialDelayMs: number;
		maxDelayMs: number;
		backoffMultiplier: number;
	};
	/** Heartbeat configuration */
	heartbeat: {
		enabled: boolean;
		intervalMs: number;
		timeoutMs: number;
	};
	/** Logger (optional) */
	logger?: {
		debug?: (message: string, meta?: any) => void;
		info?: (message: string, meta?: any) => void;
		warn?: (message: string, meta?: any) => void;
		error?: (message: string, meta?: any) => void;
	};
}

/**
 * WebSocket connection manager with auto-reconnection
 *
 * Handles connection lifecycle, reconnection, heartbeat, and message queuing.
 */
export class WebSocketConnection extends WebSocketEventEmitter {
	private ws: WebSocket | null = null;
	private state: ConnectionState = 'disconnected';
	private reconnectAttempt: number = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private heartbeat: HeartbeatManager | null = null;
	private messageQueue: MessageQueue;
	private token: string | null = null;

	constructor(private readonly options: WebSocketConnectionOptions) {
		super();
		this.token = options.token || null;
		this.messageQueue = new MessageQueue(100);
	}

	/**
	 * Connect to WebSocket server
	 *
	 * @example
	 * ```typescript
	 * await connection.connect();
	 * ```
	 */
	async connect(): Promise<void> {
		if (this.state === 'connected' || this.state === 'connecting') {
			return;
		}
		if (!this.token) {
			throw new ConnectionError('Token must be set before connecting. Call setToken() first.');
		}
		if (isTokenExpired(this.token)) {
			throw new ConnectionError('WebSocket token is expired. Fetch a fresh token before connecting.');
		}

		this.setState('connecting');
		this.log('info', 'Connecting to WebSocket...');

		return new Promise((resolve, reject) => {
			try {
				const url = this.buildUrl();
				this.ws = new WebSocket(url);

				this.ws.onopen = () => {
					this.log('info', 'WebSocket connected');
					this.setState('connected');
					this.reconnectAttempt = 0;
					this.emit('open', {});

					// Start heartbeat
					if (this.options.heartbeat.enabled && this.ws) {
						this.heartbeat = new HeartbeatManager(
							this.ws,
							this.options.heartbeat.intervalMs,
							this.options.heartbeat.timeoutMs,
							() => {
								this.log('warn', 'Heartbeat timeout - reconnecting');
								this.reconnect();
							}
						);
						this.heartbeat.start();
					}

					// Flush queued messages
					this.messageQueue.flush((message) => {
						this.ws!.send(JSON.stringify(message));
					});

					resolve();
				};

				this.ws.onclose = (event) => {
					this.log('info', 'WebSocket closed', {
						code: event.code,
						reason: event.reason,
					});
					this.cleanup();
					this.emit('close', { code: event.code, reason: event.reason });

					// Auto-reconnect if not a clean close
					if (this.options.reconnect.enabled && !event.wasClean) {
						this.reconnect();
					}
				};

				this.ws.onerror = (error) => {
					this.log('error', 'WebSocket error', error);
					this.emit('error', { error });
					reject(new ConnectionError('WebSocket connection failed'));
				};

				this.ws.onmessage = (event) => {
					try {
						const message = JSON.parse(event.data);

						// Handle pong for heartbeat
						if (message.type === 'pong' || message.action === 'pong') {
							this.heartbeat?.receivedPong();
							return;
						}

						this.emit('message', { data: message });
					} catch (error) {
						this.log('error', 'Failed to parse message', error);
					}
				};
			} catch (error) {
				this.log('error', 'Connection failed', error);
				reject(error);
			}
		});
	}

	/**
	 * Disconnect from WebSocket server
	 *
	 * @param graceful - Whether to wait for pending messages (default: true)
	 *
	 * @example
	 * ```typescript
	 * connection.disconnect();
	 * ```
	 */
	disconnect(graceful: boolean = true): void {
		if (this.state === 'disconnected' || this.state === 'disconnecting') {
			return;
		}

		this.setState('disconnecting');
		this.log('info', 'Disconnecting...');

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (graceful && this.messageQueue.hasMessages()) {
			// Wait for queued messages to flush
			setTimeout(() => {
				this.ws?.close(1000, 'Client disconnect');
			}, 1000);
		} else {
			this.ws?.close(1000, 'Client disconnect');
		}

		this.cleanup();
	}

	/**
	 * Send a message
	 *
	 * @param message - Message to send
	 *
	 * @example
	 * ```typescript
	 * await connection.send({ action: 'subscribe', type: 'task', id: 'task-123' });
	 * ```
	 */
	async send(message: any): Promise<void> {
		if (this.state !== 'connected') {
			// Queue message for when connection is restored
			this.messageQueue.enqueue(message);
			this.log('debug', 'Message queued (not connected)', message);
			return;
		}

		try {
			this.ws!.send(JSON.stringify(message));
			this.log('debug', 'Message sent', message);
		} catch (error) {
			this.log('error', 'Failed to send message', error);
			this.messageQueue.enqueue(message);
			throw new ConnectionError('Failed to send message');
		}
	}

	/**
	 * Get current connection state
	 *
	 * @returns Current state
	 *
	 * @example
	 * ```typescript
	 * const state = connection.getState();
	 * // 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'reconnecting'
	 * ```
	 */
	getState(): ConnectionState {
		return this.state;
	}

	/**
	 * Check if connected
	 *
	 * @returns True if connected
	 *
	 * @example
	 * ```typescript
	 * if (connection.isConnected()) {
	 *   await connection.send(message);
	 * }
	 * ```
	 */
	isConnected(): boolean {
		return this.state === 'connected';
	}

	/**
	 * Update token (for refresh)
	 *
	 * Disconnects and reconnects with new token.
	 *
	 * @param token - New JWT token
	 *
	 * @example
	 * ```typescript
	 * connection.updateToken(newToken);
	 * ```
	 */
	updateToken(token: string): void {
		this.token = token;
		// Reconnect with new token
		if (this.isConnected()) {
			this.disconnect();
			setTimeout(() => this.connect(), 100);
		}
	}

	/**
	 * Set token
	 *
	 * @param token - JWT token
	 *
	 * @example
	 * ```typescript
	 * connection.setToken('eyJhbGc...');
	 * ```
	 */
	setToken(token: string): void {
		this.token = token;
	}

	/**
	 * Get current token
	 *
	 * @returns Current token or null
	 *
	 * @example
	 * ```typescript
	 * const token = connection.getToken();
	 * ```
	 */
	getToken(): string | null {
		return this.token;
	}

	/**
	 * Check if token is set
	 *
	 * @returns True if token is set
	 *
	 * @example
	 * ```typescript
	 * if (connection.hasToken()) {
	 *   await connection.connect();
	 * }
	 * ```
	 */
	hasToken(): boolean {
		return this.token !== null;
	}

	/**
	 * Reconnect to WebSocket
	 */
	private reconnect(): void {
		if (!this.options.reconnect.enabled) {
			return;
		}

		if (this.reconnectAttempt >= this.options.reconnect.maxAttempts) {
			this.log('error', 'Max reconnection attempts reached');
			this.setState('disconnected');
			this.emit('error', { error: new ConnectionError('Max reconnection attempts reached') });
			return;
		}

		this.setState('reconnecting');
		this.reconnectAttempt++;

		const delay = calculateBackoff(
			this.reconnectAttempt - 1,
			this.options.reconnect.initialDelayMs,
			this.options.reconnect.maxDelayMs,
			this.options.reconnect.backoffMultiplier
		);

		this.log('info', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})...`);
		this.emit('reconnecting', { attempt: this.reconnectAttempt, delay });

		this.reconnectTimer = setTimeout(() => {
			this.connect().catch((error) => {
				this.log('error', 'Reconnection failed', error);
				this.reconnect(); // Try again
			});
		}, delay);
	}

	/**
	 * Cleanup resources
	 */
	private cleanup(): void {
		this.heartbeat?.stop();
		this.heartbeat = null;
		this.ws = null;
		this.setState('disconnected');
	}

	/**
	 * Set connection state
	 */
	private setState(state: ConnectionState): void {
		this.state = state;
	}

	/**
	 * Build WebSocket URL with query parameters
	 */
	private buildUrl(): string {
		if (!this.token) {
			throw new ConnectionError('Token must be set before connecting. Call setToken() first.');
		}

		return buildRelayWebSocketUrl({
			token: this.token,
			baseUrl: this.options.url,
			connectionType: 'APP',
			deviceId: this.options.deviceId,
		});
	}

	/**
	 * Log message using configured logger
	 */
	private log(level: string, message: string, meta?: any): void {
		const logger = this.options.logger;
		if (!logger) return;

		switch (level) {
			case 'debug':
				logger.debug?.(message, meta);
				break;
			case 'info':
				logger.info?.(message, meta);
				break;
			case 'warn':
				logger.warn?.(message, meta);
				break;
			case 'error':
				logger.error?.(message, meta);
				break;
		}
	}
}
