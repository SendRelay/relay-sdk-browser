import { describe, it, expect, vi } from 'vitest';
import { MessageQueue } from './queue';

describe('MessageQueue', () => {
	it('should enqueue messages', () => {
		const queue = new MessageQueue(10);

		queue.enqueue({ type: 'message1' });
		queue.enqueue({ type: 'message2' });
		queue.enqueue({ type: 'message3' });

		expect(queue.size).toBe(3);
		expect(queue.hasMessages()).toBe(true);
	});

	it('should flush messages in FIFO order', () => {
		const queue = new MessageQueue(10);
		const sentMessages: any[] = [];

		queue.enqueue({ id: 1 });
		queue.enqueue({ id: 2 });
		queue.enqueue({ id: 3 });

		queue.flush((message) => {
			sentMessages.push(message);
		});

		expect(sentMessages).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
		expect(queue.size).toBe(0);
		expect(queue.hasMessages()).toBe(false);
	});

	it('should remove oldest message when queue is full', () => {
		const queue = new MessageQueue(3);

		queue.enqueue({ id: 1 });
		queue.enqueue({ id: 2 });
		queue.enqueue({ id: 3 });
		queue.enqueue({ id: 4 }); // Should remove id: 1

		expect(queue.size).toBe(3);

		const sentMessages: any[] = [];
		queue.flush((message) => {
			sentMessages.push(message);
		});

		expect(sentMessages).toEqual([{ id: 2 }, { id: 3 }, { id: 4 }]);
	});

	it('should put message back at front of queue if send fails', () => {
		const queue = new MessageQueue(10);
		const sentMessages: any[] = [];

		queue.enqueue({ id: 1 });
		queue.enqueue({ id: 2 });
		queue.enqueue({ id: 3 });

		let attemptCount = 0;
		queue.flush((message) => {
			attemptCount++;
			if (message.id === 2) {
				throw new Error('Send failed');
			}
			sentMessages.push(message);
		});

		// Should send id:1, fail on id:2, stop
		expect(sentMessages).toEqual([{ id: 1 }]);
		expect(queue.size).toBe(2); // id:2 and id:3 still in queue
		expect(attemptCount).toBe(2);
	});

	it('should handle empty queue flush', () => {
		const queue = new MessageQueue(10);
		const sendFn = vi.fn();

		queue.flush(sendFn);

		expect(sendFn).not.toHaveBeenCalled();
	});

	it('should clear all messages', () => {
		const queue = new MessageQueue(10);

		queue.enqueue({ id: 1 });
		queue.enqueue({ id: 2 });
		queue.enqueue({ id: 3 });

		expect(queue.size).toBe(3);

		queue.clear();

		expect(queue.size).toBe(0);
		expect(queue.hasMessages()).toBe(false);
	});

	it('should handle maxSize of 1', () => {
		const queue = new MessageQueue(1);

		queue.enqueue({ id: 1 });
		expect(queue.size).toBe(1);

		queue.enqueue({ id: 2 });
		expect(queue.size).toBe(1);

		const sentMessages: any[] = [];
		queue.flush((message) => {
			sentMessages.push(message);
		});

		expect(sentMessages).toEqual([{ id: 2 }]); // id:1 was removed
	});

	it('should handle large queue', () => {
		const queue = new MessageQueue(1000);

		for (let i = 0; i < 1000; i++) {
			queue.enqueue({ id: i });
		}

		expect(queue.size).toBe(1000);

		const sentMessages: any[] = [];
		queue.flush((message) => {
			sentMessages.push(message);
		});

		expect(sentMessages.length).toBe(1000);
		expect(sentMessages[0].id).toBe(0);
		expect(sentMessages[999].id).toBe(999);
	});

	it('should handle complex message objects', () => {
		const queue = new MessageQueue(10);

		const message1 = {
			action: 'subscribe',
			type: 'task',
			id: 'task-123',
			metadata: { foo: 'bar' },
		};

		const message2 = {
			action: 'updateLocation',
			location: { lat: 6.5244, lng: 3.3792 },
			timestamp: new Date().toISOString(),
		};

		queue.enqueue(message1);
		queue.enqueue(message2);

		const sentMessages: any[] = [];
		queue.flush((message) => {
			sentMessages.push(message);
		});

		expect(sentMessages).toEqual([message1, message2]);
	});

	it('should preserve message order across multiple flush calls with failures', () => {
		const queue = new MessageQueue(10);

		queue.enqueue({ id: 1 });
		queue.enqueue({ id: 2 });
		queue.enqueue({ id: 3 });
		queue.enqueue({ id: 4 });

		const sentMessages: any[] = [];

		// First flush: fail on id:3
		queue.flush((message) => {
			if (message.id === 3) {
				throw new Error('Fail');
			}
			sentMessages.push(message);
		});

		expect(sentMessages).toEqual([{ id: 1 }, { id: 2 }]);
		expect(queue.size).toBe(2); // id:3, id:4

		// Second flush: succeed
		queue.flush((message) => {
			sentMessages.push(message);
		});

		expect(sentMessages).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
		expect(queue.size).toBe(0);
	});
});
