import { describe, it, expect, vi } from 'vitest';
import { SubscriptionManager } from './manager';
import { EventEmitter } from '../events/emitter';

describe('SubscriptionManager', () => {
	it('should add subscription', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		manager.add('task', 'task-123');

		expect(manager.has('task', 'task-123')).toBe(true);
		expect(manager.count).toBe(1);
	});

	it('should add multiple subscriptions', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		manager.add('task', 'task-123');
		manager.add('task', 'task-456');
		manager.add('rider', 'rider-789');

		expect(manager.count).toBe(3);
		expect(manager.has('task', 'task-123')).toBe(true);
		expect(manager.has('task', 'task-456')).toBe(true);
		expect(manager.has('rider', 'rider-789')).toBe(true);
	});

	it('should remove subscription', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		manager.add('task', 'task-123');
		expect(manager.has('task', 'task-123')).toBe(true);

		manager.remove('task', 'task-123');
		expect(manager.has('task', 'task-123')).toBe(false);
		expect(manager.count).toBe(0);
	});

	it('should handle removing non-existent subscription gracefully', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		expect(() => {
			manager.remove('task', 'task-999');
		}).not.toThrow();
	});

	it('should check if subscription exists', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		manager.add('task', 'task-123');

		expect(manager.has('task', 'task-123')).toBe(true);
		expect(manager.has('task', 'task-456')).toBe(false);
		expect(manager.has('rider', 'rider-123')).toBe(false);
	});

	it('should clear all subscriptions', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		manager.add('task', 'task-123');
		manager.add('task', 'task-456');
		manager.add('rider', 'rider-789');

		expect(manager.count).toBe(3);

		manager.clear();

		expect(manager.count).toBe(0);
		expect(manager.has('task', 'task-123')).toBe(false);
		expect(manager.has('task', 'task-456')).toBe(false);
		expect(manager.has('rider', 'rider-789')).toBe(false);
	});

	it('should get all subscriptions', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		manager.add('task', 'task-123');
		manager.add('task', 'task-456');
		manager.add('rider', 'rider-789');

		const subs = manager.getAll();

		expect(subs).toHaveLength(3);
		expect(subs).toContainEqual({ type: 'task', id: 'task-123', active: true });
		expect(subs).toContainEqual({ type: 'task', id: 'task-456', active: true });
		expect(subs).toContainEqual({ type: 'rider', id: 'rider-789', active: true });
	});

	it('should return correct count', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		expect(manager.count).toBe(0);

		manager.add('task', 'task-123');
		expect(manager.count).toBe(1);

		manager.add('task', 'task-456');
		expect(manager.count).toBe(2);

		manager.remove('task', 'task-123');
		expect(manager.count).toBe(1);

		manager.clear();
		expect(manager.count).toBe(0);
	});

	it('should handle duplicate subscriptions (replace existing)', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		manager.add('task', 'task-123');
		manager.add('task', 'task-123'); // Duplicate

		// Should only have one subscription (duplicate replaces)
		expect(manager.count).toBe(1);
		expect(manager.has('task', 'task-123')).toBe(true);
	});

	it('should distinguish between types with same ID', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		const sharedId = 'abc-123';

		manager.add('task', sharedId);
		manager.add('rider', sharedId);

		expect(manager.count).toBe(2);
		expect(manager.has('task', sharedId)).toBe(true);
		expect(manager.has('rider', sharedId)).toBe(true);

		manager.remove('task', sharedId);

		expect(manager.count).toBe(1);
		expect(manager.has('task', sharedId)).toBe(false);
		expect(manager.has('rider', sharedId)).toBe(true);
	});

	it('should handle empty state correctly', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		expect(manager.count).toBe(0);
		expect(manager.getAll()).toEqual([]);
		expect(manager.has('task', 'any-id')).toBe(false);
	});

	it('should emit CONNECTION_OPEN event when resubscribing', async () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		const emitSpy = vi.spyOn(events, 'emit');

		manager.add('task', 'task-123');
		manager.add('rider', 'rider-456');

		await manager.resubscribeAll();

		// Should emit CONNECTION_OPEN for each subscription
		expect(emitSpy).toHaveBeenCalledWith('CONNECTION_OPEN', {
			state: 'connected',
		});

		// Note: The current implementation emits once per subscription
		// which may not be the desired behavior. This test documents current behavior.
		expect(emitSpy).toHaveBeenCalled();
	});

	it('should handle resubscribeAll with no subscriptions', async () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		const emitSpy = vi.spyOn(events, 'emit');

		await manager.resubscribeAll();

		// Should not emit any events
		expect(emitSpy).not.toHaveBeenCalled();
	});

	it('should maintain subscription state after operations', () => {
		const events = new EventEmitter();
		const manager = new SubscriptionManager(events);

		manager.add('task', 'task-1');
		manager.add('task', 'task-2');
		manager.add('task', 'task-3');

		manager.remove('task', 'task-2');

		const subs = manager.getAll();

		expect(subs).toHaveLength(2);
		expect(subs).toContainEqual({ type: 'task', id: 'task-1', active: true });
		expect(subs).toContainEqual({ type: 'task', id: 'task-3', active: true });
		expect(subs).not.toContainEqual({ type: 'task', id: 'task-2', active: true });
	});
});
