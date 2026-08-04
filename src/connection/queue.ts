/**
 * Message queue for storing messages when WebSocket is disconnected
 *
 * @module connection/queue
 */

/**
 * FIFO message queue with size limit
 *
 * Stores messages when WebSocket is offline and replays them when reconnected.
 */
export class MessageQueue {
	private queue: any[] = [];
	private readonly maxSize: number;

	/**
	 * Create a new message queue
	 *
	 * @param maxSize - Maximum queue size (default: 100)
	 */
	constructor(maxSize: number = 100) {
		this.maxSize = maxSize;
	}

	/**
	 * Enqueue a message
	 *
	 * If queue is full, oldest message is removed (FIFO).
	 *
	 * @param message - Message to enqueue
	 *
	 * @example
	 * ```typescript
	 * queue.enqueue({ action: 'subscribe', type: 'task', id: 'task-123' });
	 * ```
	 */
	enqueue(message: any): void {
		if (this.queue.length >= this.maxSize) {
			// Remove oldest message (FIFO)
			this.queue.shift();
		}
		this.queue.push(message);
	}

	/**
	 * Flush all messages to the send function
	 *
	 * Messages are sent in FIFO order. If send fails, the message is
	 * put back at the front of the queue.
	 *
	 * @param sendFn - Function to send each message
	 *
	 * @example
	 * ```typescript
	 * queue.flush((message) => {
	 *   ws.send(JSON.stringify(message));
	 * });
	 * ```
	 */
	flush(sendFn: (message: any) => void): void {
		while (this.queue.length > 0) {
			const message = this.queue.shift();
			try {
				sendFn(message);
			} catch (error) {
				// Put message back at front of queue if send fails
				this.queue.unshift(message);
				break;
			}
		}
	}

	/**
	 * Clear all messages
	 */
	clear(): void {
		this.queue = [];
	}

	/**
	 * Check if queue has messages
	 */
	hasMessages(): boolean {
		return this.queue.length > 0;
	}

	/**
	 * Get current queue size
	 */
	get size(): number {
		return this.queue.length;
	}
}
