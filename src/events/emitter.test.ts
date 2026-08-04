import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from './emitter';

describe('EventEmitter', () => {
	it('should register and call event listener', () => {
		const emitter = new EventEmitter();
		const handler = vi.fn();

		emitter.on('TASK_ASSIGNED', handler);
		emitter.emit('TASK_ASSIGNED', { taskId: 'task-123' });

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({ taskId: 'task-123' });
	});

	it('should call multiple listeners for same event', () => {
		const emitter = new EventEmitter();
		const handler1 = vi.fn();
		const handler2 = vi.fn();
		const handler3 = vi.fn();

		emitter.on('TASK_COMPLETED', handler1);
		emitter.on('TASK_COMPLETED', handler2);
		emitter.on('TASK_COMPLETED', handler3);

		emitter.emit('TASK_COMPLETED', { taskId: 'task-123' });

		expect(handler1).toHaveBeenCalledTimes(1);
		expect(handler2).toHaveBeenCalledTimes(1);
		expect(handler3).toHaveBeenCalledTimes(1);
	});

	it('should not call listeners for different events', () => {
		const emitter = new EventEmitter();
		const taskHandler = vi.fn();
		const riderHandler = vi.fn();

		emitter.on('TASK_ASSIGNED', taskHandler);
		emitter.on('RIDER_LOCATION_UPDATE', riderHandler);

		emitter.emit('TASK_ASSIGNED', { taskId: 'task-123' });

		expect(taskHandler).toHaveBeenCalledTimes(1);
		expect(riderHandler).not.toHaveBeenCalled();
	});

	it('should remove listener with off()', () => {
		const emitter = new EventEmitter();
		const handler = vi.fn();

		emitter.on('TASK_ASSIGNED', handler);
		emitter.emit('TASK_ASSIGNED', { taskId: 'task-123' });

		expect(handler).toHaveBeenCalledTimes(1);

		emitter.off('TASK_ASSIGNED', handler);
		emitter.emit('TASK_ASSIGNED', { taskId: 'task-456' });

		expect(handler).toHaveBeenCalledTimes(1); // Not called again
	});

	it('should return cleanup function from on()', () => {
		const emitter = new EventEmitter();
		const handler = vi.fn();

		const unsubscribe = emitter.on('TASK_ASSIGNED', handler);
		emitter.emit('TASK_ASSIGNED', { taskId: 'task-123' });

		expect(handler).toHaveBeenCalledTimes(1);

		unsubscribe();
		emitter.emit('TASK_ASSIGNED', { taskId: 'task-456' });

		expect(handler).toHaveBeenCalledTimes(1); // Not called again
	});

	it('should handle once() listener', () => {
		const emitter = new EventEmitter();
		const handler = vi.fn();

		emitter.once('TASK_COMPLETED', handler);

		emitter.emit('TASK_COMPLETED', { taskId: 'task-123' });
		emitter.emit('TASK_COMPLETED', { taskId: 'task-456' });
		emitter.emit('TASK_COMPLETED', { taskId: 'task-789' });

		expect(handler).toHaveBeenCalledTimes(1); // Called only once
		expect(handler).toHaveBeenCalledWith({ taskId: 'task-123' });
	});

	it('should handle errors in event handlers without crashing', () => {
		const emitter = new EventEmitter();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const faultyHandler = vi.fn(() => {
			throw new Error('Handler error');
		});
		const normalHandler = vi.fn();

		emitter.on('TASK_ASSIGNED', faultyHandler);
		emitter.on('TASK_ASSIGNED', normalHandler);

		emitter.emit('TASK_ASSIGNED', { taskId: 'task-123' });

		// Faulty handler should be called and error logged
		expect(faultyHandler).toHaveBeenCalledTimes(1);
		expect(consoleErrorSpy).toHaveBeenCalled();

		// Normal handler should still be called
		expect(normalHandler).toHaveBeenCalledTimes(1);

		consoleErrorSpy.mockRestore();
	});

	it('should remove all listeners for an event', () => {
		const emitter = new EventEmitter();
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		emitter.on('TASK_ASSIGNED', handler1);
		emitter.on('TASK_ASSIGNED', handler2);

		emitter.removeAllListeners('TASK_ASSIGNED');
		emitter.emit('TASK_ASSIGNED', { taskId: 'task-123' });

		expect(handler1).not.toHaveBeenCalled();
		expect(handler2).not.toHaveBeenCalled();
	});

	it('should remove all listeners for all events', () => {
		const emitter = new EventEmitter();
		const handler1 = vi.fn();
		const handler2 = vi.fn();
		const handler3 = vi.fn();

		emitter.on('TASK_ASSIGNED', handler1);
		emitter.on('TASK_COMPLETED', handler2);
		emitter.on('RIDER_LOCATION_UPDATE', handler3);

		emitter.removeAllListeners();

		emitter.emit('TASK_ASSIGNED', {});
		emitter.emit('TASK_COMPLETED', {});
		emitter.emit('RIDER_LOCATION_UPDATE', {});

		expect(handler1).not.toHaveBeenCalled();
		expect(handler2).not.toHaveBeenCalled();
		expect(handler3).not.toHaveBeenCalled();
	});

	it('should return correct listener count', () => {
		const emitter = new EventEmitter();

		expect(emitter.listenerCount('TASK_ASSIGNED')).toBe(0);

		emitter.on('TASK_ASSIGNED', () => {});
		expect(emitter.listenerCount('TASK_ASSIGNED')).toBe(1);

		emitter.on('TASK_ASSIGNED', () => {});
		expect(emitter.listenerCount('TASK_ASSIGNED')).toBe(2);

		emitter.on('TASK_ASSIGNED', () => {});
		expect(emitter.listenerCount('TASK_ASSIGNED')).toBe(3);

		emitter.removeAllListeners('TASK_ASSIGNED');
		expect(emitter.listenerCount('TASK_ASSIGNED')).toBe(0);
	});

	it('should handle multiple event types independently', () => {
		const emitter = new EventEmitter();
		const taskHandler = vi.fn();
		const riderHandler = vi.fn();
		const paymentHandler = vi.fn();

		emitter.on('TASK_ASSIGNED', taskHandler);
		emitter.on('RIDER_LOCATION_UPDATE', riderHandler);
		emitter.on('PAYMENT_RELEASED', paymentHandler);

		emitter.emit('TASK_ASSIGNED', { taskId: 'task-123' });
		emitter.emit('RIDER_LOCATION_UPDATE', { riderId: 'rider-456' });
		emitter.emit('PAYMENT_RELEASED', { amount: 5000 });

		expect(taskHandler).toHaveBeenCalledWith({ taskId: 'task-123' });
		expect(riderHandler).toHaveBeenCalledWith({ riderId: 'rider-456' });
		expect(paymentHandler).toHaveBeenCalledWith({ amount: 5000 });
	});

	it('should handle removing non-existent listener gracefully', () => {
		const emitter = new EventEmitter();
		const handler = vi.fn();

		// Removing a listener that was never added should not throw
		expect(() => {
			emitter.off('TASK_ASSIGNED', handler);
		}).not.toThrow();
	});

	it('should handle emitting event with no listeners', () => {
		const emitter = new EventEmitter();

		// Should not throw when emitting with no listeners
		expect(() => {
			emitter.emit('TASK_ASSIGNED', { taskId: 'task-123' });
		}).not.toThrow();
	});

	it('should preserve listener order', () => {
		const emitter = new EventEmitter();
		const callOrder: number[] = [];

		emitter.on('TASK_ASSIGNED', () => callOrder.push(1));
		emitter.on('TASK_ASSIGNED', () => callOrder.push(2));
		emitter.on('TASK_ASSIGNED', () => callOrder.push(3));

		emitter.emit('TASK_ASSIGNED', {});

		expect(callOrder).toEqual([1, 2, 3]);
	});

	it('should handle adding same listener multiple times', () => {
		const emitter = new EventEmitter();
		const handler = vi.fn();

		emitter.on('TASK_ASSIGNED', handler);
		emitter.on('TASK_ASSIGNED', handler);
		emitter.on('TASK_ASSIGNED', handler);

		// EventEmitter de-duplicates handler instances via Set.
		expect(emitter.listenerCount('TASK_ASSIGNED')).toBe(1);

		emitter.emit('TASK_ASSIGNED', {});

		expect(handler).toHaveBeenCalledTimes(1);
	});
});
