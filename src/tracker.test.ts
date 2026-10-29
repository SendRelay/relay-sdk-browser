import { describe, expect, it, vi } from 'vitest';
import { createTaskTracker } from './tracker';

function fakeClient() {
	const handlers = new Map<string, Set<(payload: any) => void>>();
	return {
		handlers,
		on: vi.fn((event: string, handler: (payload: any) => void) => {
			if (!handlers.has(event)) handlers.set(event, new Set());
			handlers.get(event)!.add(handler);
			return () => handlers.get(event)!.delete(handler);
		}),
		emit(event: string, payload: any) {
			for (const handler of handlers.get(event) ?? []) handler(payload);
		},
		listen: vi.fn(async () => {}),
		stopListening: vi.fn(async () => {}),
	};
}

const location = (eta?: object, stageIndex = 0) => ({
	taskId: 't1',
	riderId: 'r1',
	location: { latitude: 6.45, longitude: 3.39, bearing: 90, speed: 8 },
	...(eta ? { eta: { stageIndex, ...eta } } : {}),
	timestamp: '2026-10-28T10:00:00.000Z',
});

describe('createTaskTracker', () => {
	it('follows a delivery from assignment to completion', async () => {
		const client = fakeClient();
		const tracker = createTaskTracker(client as any, 't1');
		const states: any[] = [];
		tracker.subscribe((s) => states.push(s));

		await tracker.start();
		expect(client.listen).toHaveBeenCalledWith('t1');
		expect(tracker.getState().connection).toBe('live');

		client.emit('TASK_ASSIGNED', { taskId: 't1', status: 'ASSIGNED', currentStageIndex: 0, assignedAt: '2026-10-28T09:59:00.000Z' });
		client.emit('RIDER_LOCATION_UPDATE', location({ seconds: 420, meters: 2350 }));

		let s = tracker.getState();
		expect(s.status).toBe('ASSIGNED');
		expect(s.rider).toMatchObject({ riderId: 'r1', latitude: 6.45, longitude: 3.39, bearing: 90, speed: 8 });
		expect(s.eta).toEqual({
			stageIndex: 0,
			seconds: 420,
			meters: 2350,
			arrivesAt: '2026-10-28T10:07:00.000Z',
			updatedAt: '2026-10-28T10:00:00.000Z',
		});

		// The pickup is done: its ETA no longer applies.
		client.emit('STAGE_COMPLETED', { taskId: 't1', stageIndex: 0, nextStageIndex: 1, timestamp: '2026-10-28T10:08:00.000Z' });
		s = tracker.getState();
		expect(s.currentStageIndex).toBe(1);
		expect(s.eta).toBeNull();

		client.emit('RIDER_LOCATION_UPDATE', location({ seconds: 60, meters: 400 }, 1));
		expect(tracker.getState().eta?.stageIndex).toBe(1);

		client.emit('TASK_COMPLETED', { taskId: 't1', status: 'COMPLETED', completedAt: '2026-10-28T10:20:00.000Z' });
		s = tracker.getState();
		expect(s.status).toBe('COMPLETED');
		expect(s.finished).toBe(true);
		expect(s.eta).toBeNull();
		expect(s.events.map((e) => e.type)).toEqual(['TASK_COMPLETED', 'STAGE_COMPLETED', 'TASK_ASSIGNED']);
		expect(states.length).toBeGreaterThan(5);
	});

	it('keeps the last ETA when a location update has none', async () => {
		const client = fakeClient();
		const tracker = createTaskTracker(client as any, 't1');
		await tracker.start();
		client.emit('RIDER_LOCATION_UPDATE', location({ seconds: 300, meters: 1500 }));
		client.emit('RIDER_LOCATION_UPDATE', location());
		expect(tracker.getState().eta?.seconds).toBe(300);
	});

	it('ignores other tasks', async () => {
		const client = fakeClient();
		const tracker = createTaskTracker(client as any, 't1');
		await tracker.start();
		client.emit('TASK_CANCELLED', { taskId: 'other', status: 'CANCELLED' });
		client.emit('RIDER_LOCATION_UPDATE', { ...location({ seconds: 1, meters: 1 }), taskId: 'other' });
		expect(tracker.getState()).toMatchObject({ status: null, rider: null, eta: null, events: [] });
	});

	it('can be seeded from a task read', () => {
		const eta = { stageIndex: 1, seconds: 90, meters: 600, arrivesAt: '2026-10-28T10:01:30.000Z', updatedAt: '2026-10-28T10:00:00.000Z' };
		const tracker = createTaskTracker(fakeClient() as any, 't1', { initial: { status: 'IN_PROGRESS', currentStageIndex: 1, eta } });
		expect(tracker.getState()).toMatchObject({ status: 'IN_PROGRESS', currentStageIndex: 1, eta, finished: false });
	});

	it('reports connection changes and failures to listen', async () => {
		const client = fakeClient();
		client.listen.mockRejectedValueOnce(new Error('token endpoint down'));
		const tracker = createTaskTracker(client as any, 't1');
		await tracker.start();
		expect(tracker.getState()).toMatchObject({ connection: 'offline' });
		expect(tracker.getState().error?.message).toBe('token endpoint down');

		client.emit('CONNECTION_OPEN', { state: 'connected' });
		expect(tracker.getState()).toMatchObject({ connection: 'live', error: null });
		client.emit('CONNECTION_RECONNECTING', { attempt: 1, delay: 1000 });
		expect(tracker.getState().connection).toBe('reconnecting');
	});

	it('stops cleanly and can start again', async () => {
		const client = fakeClient();
		const tracker = createTaskTracker(client as any, 't1');
		await tracker.start();
		await tracker.start();
		expect(client.listen).toHaveBeenCalledTimes(1);

		await tracker.stop();
		expect(client.stopListening).toHaveBeenCalledWith('t1');
		expect([...client.handlers.values()].every((set) => set.size === 0)).toBe(true);
		expect(tracker.getState().connection).toBe('idle');

		await tracker.start();
		expect(client.listen).toHaveBeenCalledTimes(2);
	});
});
