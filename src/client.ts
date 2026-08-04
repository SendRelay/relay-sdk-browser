/**
 * Relay Real-time WebSocket Client
 *
 * Main entry point for the Relay browser SDK. Provides real-time task and rider
 * updates via WebSocket subscriptions.
 *
 * @module client
 *
 * @example
 * ```typescript
 * import { RelayRealtimeClient } from '@relay-sdk/sdk-browser';
 *
 * const relay = new RelayRealtimeClient({
 *   token: 'your-jwt-token',
 *   autoConnect: true,
 * });
 *
 * // Listen for task updates
 * relay.on('TASK_ASSIGNED', (event) => {
 *   console.log('Task assigned to rider:', event.riderId);
 * });
 *
 * // Subscribe to task
 * await relay.subscribe('task', 'task-123');
 * ```
 */

import { WebSocketConnection, type WebSocketConnectionOptions } from './connection/websocket';
import { RELAY_DEFAULT_WEBSOCKET_URL } from './connection/websocket_url';
import { TokenError } from './errors';
import { EventEmitter } from './events/emitter';
import { SubscriptionManager } from './subscription/manager';
import type { ConnectionState, EventHandler, EventType } from './types';
import { getTimeUntilExpiration, isTokenExpired } from './utils/token';

/**
 * Client configuration options
 */
export interface RelayRealtimeClientOptions {
  /**
   * Callback to fetch authentication token from your backend.
   *
   * The SDK calls this when it needs a token (on first listen() or token refresh).
   * You should implement this to fetch a scoped session token from your backend.
   *
   * @param taskIds - Array of task IDs that need access
   * @returns JWT token scoped to these tasks
   *
   * @example
   * ```typescript
   * getToken: async (taskIds) => {
   *   const res = await fetch('/api/relay/token', {
   *     method: 'POST',
   *     body: JSON.stringify({ taskIds }),
   *   });
   *   return (await res.json()).token;
   * }
   * ```
   */
  getToken: (taskIds: string[]) => Promise<string> | string;

  /** WebSocket URL (default: wss://ws.sendrelay.com.ng/v1) */
  url?: string;

  /** Unique device ID (optional) */
  deviceId?: string;

  /** Auto-refresh tokens before expiration (default: true) */
  autoRefresh?: boolean;

  /** Token expiration warning threshold in ms (default: 5 minutes) */
  tokenExpirationWarningMs?: number;

  /** Reconnection configuration */
  reconnect?: {
    enabled?: boolean;
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  };

  /** Heartbeat configuration */
  heartbeat?: {
    enabled?: boolean;
    intervalMs?: number;
    timeoutMs?: number;
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
 * Relay Real-time Client
 *
 * WebSocket client for real-time task updates with automatic token management.
 *
 * Features:
 * - Automatic token provisioning and refresh
 * - Automatic reconnection with exponential backoff
 * - Connection pooling across token refresh (preserves subscriptions)
 * - Offline message queuing
 * - Type-safe event listeners
 *
 * @example
 * ```typescript
 * const relay = new RelayRealtimeClient({
 *   getToken: async (taskIds) => {
 *     const res = await fetch('/api/relay/token', {
 *       method: 'POST',
 *       body: JSON.stringify({ taskIds }),
 *     });
 *     return (await res.json()).token;
 *   },
 * });
 *
 * // Listen to task updates
 * await relay.listen('task-123');
 *
 * // Register event handlers
 * relay.on('TASK_ASSIGNED', (event) => {
 *   setRider(event.riderId);
 * });
 *
 * relay.on('RIDER_LOCATION_UPDATE', (event) => {
 *   updateMap(event.location);
 * });
 * ```
 */
export class RelayRealtimeClient {
  private connection: WebSocketConnection;
  private subscriptions: SubscriptionManager;
  private events: EventEmitter;
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private currentToken: string | null = null;
  private listeningTo = new Set<string>(); // Track task IDs being listened to
  private options: Required<
    Omit<RelayRealtimeClientOptions, 'reconnect' | 'heartbeat' | 'logger' | 'deviceId'>
  > & {
    deviceId?: string;
    reconnect: Required<NonNullable<RelayRealtimeClientOptions['reconnect']>>;
    heartbeat: Required<NonNullable<RelayRealtimeClientOptions['heartbeat']>>;
    logger?: RelayRealtimeClientOptions['logger'];
  };

  /**
   * Create a new Relay real-time client
   *
   * @param options - Client configuration
   *
   * @example
   * ```typescript
   * const relay = new RelayRealtimeClient({
   *   getToken: async (taskIds) => {
   *     const res = await fetch('/api/relay/token', {
   *       method: 'POST',
   *       body: JSON.stringify({ taskIds }),
   *     });
   *     return (await res.json()).token;
   *   },
   * });
   * ```
   */
  constructor(options: RelayRealtimeClientOptions) {
    // Validate getToken callback
    if (!options.getToken) {
      throw new Error('getToken callback is required');
    }

    // Merge with defaults
    this.options = {
      getToken: options.getToken,
      deviceId: options.deviceId,
      url: options.url || RELAY_DEFAULT_WEBSOCKET_URL,
      autoRefresh: options.autoRefresh ?? true,
      tokenExpirationWarningMs: options.tokenExpirationWarningMs ?? 5 * 60 * 1000, // 5 minutes
      reconnect: {
        enabled: options.reconnect?.enabled ?? true,
        maxAttempts: options.reconnect?.maxAttempts ?? Infinity,
        initialDelayMs: options.reconnect?.initialDelayMs ?? 1000,
        maxDelayMs: options.reconnect?.maxDelayMs ?? 30000,
        backoffMultiplier: options.reconnect?.backoffMultiplier ?? 1.5,
      },
      heartbeat: {
        enabled: options.heartbeat?.enabled ?? true,
        intervalMs: options.heartbeat?.intervalMs ?? 30000,
        timeoutMs: options.heartbeat?.timeoutMs ?? 10000,
      },
      logger: options.logger,
    };

    // Initialize components
    this.events = new EventEmitter();
    this.subscriptions = new SubscriptionManager(this.events);

    // Create WebSocket connection (token will be set on first listen() call)
    const connectionOptions: Omit<WebSocketConnectionOptions, 'token'> & { token?: string } = {
      url: this.options.url,
      deviceId: this.options.deviceId,
      reconnect: this.options.reconnect,
      heartbeat: this.options.heartbeat,
      logger: this.options.logger,
    };

    this.connection = new WebSocketConnection(connectionOptions as WebSocketConnectionOptions);

    // Wire up connection handlers
    this.setupConnectionHandlers();

    // No auto-connect - connection is lazy on first listen() call
  }

  /**
   * Connect to WebSocket server
   *
   * Automatically fetches token for all tasks being listened to.
   *
   * @example
   * ```typescript
   * await relay.connect();
   * ```
   */
  async connect(): Promise<void> {
    // Fetch token for all tasks we're listening to
    const taskIds = Array.from(this.listeningTo);

    this.log('info', `Fetching token for ${taskIds.length} task(s)...`);

    try {
      const token = await this.fetchValidToken(taskIds);

      // Set token in connection
      if (this.connection.setToken) {
        this.connection.setToken(token);
      }
      this.currentToken = token;

      // Schedule token refresh
      this.scheduleTokenRefresh();

      // Connect to WebSocket
      await this.connection.connect();

      this.log('info', 'Connected successfully');
    } catch (error) {
      this.log('error', 'Failed to connect', error);
      throw new Error(
        `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Disconnect from WebSocket server
   *
   * @param graceful - Whether to wait for pending messages (default: true)
   *
   * @example
   * ```typescript
   * relay.disconnect();
   * ```
   */
  disconnect(graceful = true): void {
    this.connection.disconnect(graceful);
    this.clearTokenRefreshTimer();
  }

  /**
   * Start listening to task events
   *
   * This is the primary method for tracking tasks. It:
   * 1. Fetches an authentication token (if needed)
   * 2. Connects to WebSocket (if not connected)
   * 3. Subscribes to task updates
   *
   * @param taskId - Task ID to listen to
   *
   * @example
   * ```typescript
   * await relay.listen('task-123');
   *
   * relay.on('TASK_ASSIGNED', (event) => {
   *   console.log('Assigned to:', event.riderId);
   * });
   * ```
   */
  async listen(taskId: string): Promise<void> {
    // Track that we're listening to this task
    this.listeningTo.add(taskId);

    // If already subscribed, skip
    if (this.subscriptions.has('task', taskId)) {
      this.log('debug', `Already listening to ${taskId}`);
      return;
    }

    // Connect if not connected (handles token fetching)
    if (!this.isConnected() && this.getState() !== 'connecting') {
      await this.connect();
    }

    // Subscribe to task
    await this.subscribeToTask(taskId);

    this.log('info', `Listening to task ${taskId}`);
  }

  /**
   * Stop listening to task events
   *
   * @param taskId - Task ID to stop listening to
   *
   * @example
   * ```typescript
   * await relay.stopListening('task-123');
   * ```
   */
  async stopListening(taskId: string): Promise<void> {
    this.listeningTo.delete(taskId);

    if (!this.subscriptions.has('task', taskId)) {
      this.log('debug', `Not listening to ${taskId}`);
      return;
    }

    // Unsubscribe from task
    await this.unsubscribeFromTask(taskId);

    this.log('info', `Stopped listening to task ${taskId}`);
  }

  /**
   * Get all task IDs being listened to
   *
   * @returns Array of task IDs
   *
   * @example
   * ```typescript
   * const taskIds = relay.getListeningTo();
   * console.log(`Listening to ${taskIds.length} tasks`);
   * ```
   */
  getListeningTo(): string[] {
    return Array.from(this.listeningTo);
  }

  /**
   * Subscribe to an event
   *
   * @param event - Event type to listen for
   * @param handler - Event handler function
   * @returns Cleanup function to remove the listener
   *
   * @example
   * ```typescript
   * const unsubscribe = relay.on('TASK_ASSIGNED', (event) => {
   *   console.log('Task assigned:', event.taskId);
   * });
   *
   * // Later: remove listener
   * unsubscribe();
   * ```
   */
  on<T extends EventType>(event: T, handler: EventHandler<T>): () => void {
    return this.events.on(event, handler);
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
   * relay.once('TASK_COMPLETED', (event) => {
   *   console.log('Task completed:', event.taskId);
   * });
   * ```
   */
  once<T extends EventType>(event: T, handler: EventHandler<T>): void {
    this.events.once(event, handler);
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
   * relay.on('TASK_ASSIGNED', handler);
   * relay.off('TASK_ASSIGNED', handler);
   * ```
   */
  off<T extends EventType>(event: T, handler: EventHandler<T>): void {
    this.events.off(event, handler);
  }

  /**
   * Get current connection state
   *
   * @returns Current state
   *
   * @example
   * ```typescript
   * const state = relay.getState();
   * // 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'reconnecting'
   * ```
   */
  getState(): ConnectionState {
    return this.connection.getState();
  }

  /**
   * Check if connected
   *
   * @returns True if connected
   *
   * @example
   * ```typescript
   * if (relay.isConnected()) {
   *   await relay.subscribe('task', taskId);
   * }
   * ```
   */
  isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * Get all active subscriptions
   *
   * @returns Array of subscriptions
   *
   * @example
   * ```typescript
   * const subs = relay.getSubscriptions();
   * console.log(`${subs.length} active subscriptions`);
   * ```
   */
  getSubscriptions() {
    return this.subscriptions.getAll();
  }

  /**
   * Clear all subscriptions
   *
   * @example
   * ```typescript
   * relay.clearSubscriptions();
   * ```
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
  }

  /**
   * Subscribe to a task (internal helper)
   */
  private async subscribeToTask(taskId: string): Promise<void> {
    // Add to local subscription tracker
    this.subscriptions.add('task', taskId);

    // Send subscribe message to server
    await this.connection.send({
      action: 'subscribe',
      type: 'task',
      id: taskId,
    });
  }

  /**
   * Unsubscribe from a task (internal helper)
   */
  private async unsubscribeFromTask(taskId: string): Promise<void> {
    // Remove from local tracker
    this.subscriptions.remove('task', taskId);

    // Send unsubscribe message to server
    await this.connection.send({
      action: 'unsubscribe',
      type: 'task',
      id: taskId,
    });
  }

  /**
   * Setup connection event handlers
   *
   * Bridges WebSocket connection events to client events.
   */
  private setupConnectionHandlers(): void {
    // Connection opened
    this.connection.on('open', () => {
      this.events.emit('CONNECTION_OPEN', {
        state: 'connected',
      });

      // Resubscribe to all active subscriptions
      this.resubscribeAll();
    });

    // Connection closed
    this.connection.on('close', (payload) => {
      this.events.emit('CONNECTION_CLOSE', {
        state: 'disconnected',
        code: payload.code,
        reason: payload.reason,
      });
    });

    // Connection error
    this.connection.on('error', (payload) => {
      const error = payload.error;
      this.events.emit('CONNECTION_ERROR', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });

    // Reconnecting
    this.connection.on('reconnecting', (payload) => {
      this.events.emit('CONNECTION_RECONNECTING', {
        attempt: payload.attempt,
        delay: payload.delay,
      });
    });

    // Incoming messages
    this.connection.on('message', (payload) => {
      this.handleIncomingMessage(payload.data);
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleIncomingMessage(message: any): void {
    let payload = message;
    let eventType = typeof message?.type === 'string' ? message.type : message?.event;

    if (
      eventType === 'TASK_UPDATE' &&
      this.isObject(message?.data) &&
      typeof message.data.type === 'string'
    ) {
      payload = message.data;
      eventType = message.data.type;
    } else if (eventType === 'RIDER_LOCATION_UPDATE' && this.isObject(message?.data)) {
      // Defensive support for direct RIDER_LOCATION_UPDATE wrappers
      payload = message.data;
    }

    if (!eventType || !this.isKnownEventType(eventType)) {
      this.log('warn', 'Received message without type', message);
      return;
    }

    // Emit to event listeners
    this.events.emit(eventType, payload);
  }

  /**
   * Resubscribe to all tracked tasks after reconnection
   *
   * CRITICAL: This preserves subscriptions across connectionId changes.
   * When the WebSocket reconnects (due to token refresh or network loss),
   * a new connectionId is assigned, invalidating the old one. This method
   * automatically resubscribes to all tasks using the new connectionId.
   */
  private async resubscribeAll(): Promise<void> {
    const taskIds = Array.from(this.listeningTo);

    if (taskIds.length === 0) {
      return;
    }

    this.log('info', `Resubscribing to ${taskIds.length} task(s) after reconnection...`);

    for (const taskId of taskIds) {
      try {
        await this.subscribeToTask(taskId);
        this.log('debug', `Resubscribed to ${taskId}`);
      } catch (error) {
        this.log('error', `Failed to resubscribe to ${taskId}`, error);
      }
    }

    this.log('info', 'Resubscription complete');
  }

  /**
   * Schedule automatic token refresh
   *
   * Refreshes token before expiration to maintain connection.
   */
  private scheduleTokenRefresh(): void {
    // Clear existing timer
    this.clearTokenRefreshTimer();

    if (!this.currentToken) return;

    try {
      const timeUntilExpiration = getTimeUntilExpiration(this.currentToken);

      if (timeUntilExpiration === null) {
        this.log('warn', 'Token has no expiration claim');
        return;
      }

      if (timeUntilExpiration <= 0) {
        this.log('error', 'Token already expired');
        return;
      }

      // Schedule refresh before expiration
      const refreshTime = timeUntilExpiration - this.options.tokenExpirationWarningMs;

      if (refreshTime > 0 && this.options.autoRefresh) {
        this.tokenRefreshTimer = setTimeout(() => {
          this.refreshToken();
        }, refreshTime);

        this.log('info', `Token refresh scheduled in ${Math.floor(refreshTime / 1000)}s`);
      } else if (this.options.autoRefresh) {
        // Refresh immediately if expiring soon
        this.refreshToken();
      }
    } catch (error) {
      this.log('error', 'Failed to schedule token refresh', error);
    }
  }

  /**
   * Refresh token with automatic reconnection
   *
   * Fetches a new token and reconnects to preserve subscriptions.
   */
  private async refreshToken(): Promise<void> {
    try {
      this.log('info', 'Refreshing token...');

      // Emit warning event (for UI feedback)
      const expiresIn = this.options.tokenExpirationWarningMs;
      this.events.emit('TOKEN_EXPIRING', {
        expiresAt: new Date(Date.now() + expiresIn).toISOString(),
        expiresIn,
        warningMs: expiresIn,
      });

      // Fetch new token for current tasks
      const taskIds = Array.from(this.listeningTo);
      const newToken = await this.fetchValidToken(taskIds);

      // Disconnect old connection
      this.connection.disconnect();

      // Set new token
      if (this.connection.setToken) {
        this.connection.setToken(newToken);
      }
      this.currentToken = newToken;

      // Reconnect (will trigger resubscribeAll via 'open' event)
      await this.connection.connect();

      // Schedule next refresh
      this.scheduleTokenRefresh();

      this.log('info', 'Token refreshed successfully');
    } catch (error) {
      this.log('error', 'Token refresh failed', error);
      this.events.emit('CONNECTION_ERROR', {
        state: this.getState(),
        error: `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Clear token refresh timer
   */
  private clearTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  private async fetchValidToken(taskIds: string[]): Promise<string> {
    let token = await this.options.getToken(taskIds);
    if (isTokenExpired(token)) {
      this.log('warn', 'Received expired WebSocket token, retrying once...');
      token = await this.options.getToken(taskIds);
      if (isTokenExpired(token)) {
        throw new TokenError(
          'Token provider returned an expired WebSocket token. Ensure your backend issues a fresh JWT before connect.',
        );
      }
    }
    return token;
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

  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
  }

  private isKnownEventType(value: string): value is EventType {
    const knownTypes: readonly EventType[] = [
      'TASK_CREATED',
      'TASK_OFFERED',
      'TASK_ASSIGNED',
      'TASK_IN_PROGRESS',
      'TASK_COMPLETED',
      'TASK_FAILED',
      'TASK_CANCELLED',
      'STAGE_COMPLETED',
      'PAYMENT_PENDING',
      'PAYMENT_RELEASED',
      'PAYMENT_DISPUTED',
      'PAYMENT_DISPUTE_RESOLVED',
      'RIDER_LOCATION_UPDATE',
      'NEW_TASK_OFFER',
      'CONNECTION_OPEN',
      'CONNECTION_CLOSE',
      'CONNECTION_ERROR',
      'CONNECTION_RECONNECTING',
      'TOKEN_EXPIRING',
    ];
    return knownTypes.includes(value as EventType);
  }
}
