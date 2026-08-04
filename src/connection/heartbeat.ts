/**
 * Heartbeat manager for WebSocket connection health monitoring
 *
 * @module connection/heartbeat
 */

/**
 * Manages WebSocket heartbeat (ping/pong) to detect dead connections
 *
 * Sends periodic ping messages and expects pong responses within a timeout.
 * Triggers reconnection if pong is not received in time.
 */
export class HeartbeatManager {
	private pingTimer: ReturnType<typeof setTimeout> | null = null;
	private pongTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Create a new heartbeat manager
	 *
	 * @param ws - WebSocket instance
	 * @param intervalMs - Ping interval in milliseconds
	 * @param timeoutMs - Pong timeout in milliseconds
	 * @param onTimeout - Callback when pong timeout occurs
	 */
	constructor(
		private readonly ws: WebSocket,
		private readonly intervalMs: number,
		private readonly timeoutMs: number,
		private readonly onTimeout: () => void
	) {}

	/**
	 * Start heartbeat monitoring
	 *
	 * @example
	 * ```typescript
	 * heartbeat.start();
	 * ```
	 */
	start(): void {
		this.stop();
		this.schedulePing();
	}

	/**
	 * Stop heartbeat monitoring
	 *
	 * @example
	 * ```typescript
	 * heartbeat.stop();
	 * ```
	 */
	stop(): void {
		if (this.pingTimer) {
			clearTimeout(this.pingTimer);
			this.pingTimer = null;
		}
		if (this.pongTimer) {
			clearTimeout(this.pongTimer);
			this.pongTimer = null;
		}
	}

	/**
	 * Notify that pong was received
	 *
	 * Call this from your WebSocket message handler when receiving pong.
	 *
	 * @example
	 * ```typescript
	 * ws.onmessage = (event) => {
	 *   const message = JSON.parse(event.data);
	 *   if (message.type === 'pong') {
	 *     heartbeat.receivedPong();
	 *   }
	 * };
	 * ```
	 */
	receivedPong(): void {
		if (this.pongTimer) {
			clearTimeout(this.pongTimer);
			this.pongTimer = null;
		}
	}

	/**
	 * Schedule next ping
	 */
	private schedulePing(): void {
		this.pingTimer = setTimeout(() => {
			this.sendPing();
		}, this.intervalMs);
	}

	/**
	 * Send ping and wait for pong
	 */
	private sendPing(): void {
		try {
			this.ws.send(JSON.stringify({ action: 'ping' }));

			// Wait for pong response
			this.pongTimer = setTimeout(() => {
				this.onTimeout();
			}, this.timeoutMs);

			// Schedule next ping
			this.schedulePing();
		} catch (error) {
			// WebSocket closed or send failed - trigger timeout callback
			this.onTimeout();
		}
	}
}
