/**
 * A framework-agnostic store for tracking one task. It holds the latest status, rider position,
 * live ETA and connection state, and notifies subscribers on every change.
 *
 * `@relay-sdk/react`, `/vue`, `/svelte` and `/react-native` are thin adapters over this store, so
 * every framework tracks a task the same way.
 *
 * @module tracker
 */

import type { RelayRealtimeClient } from './client';
import type { EventType, RiderRouteEta } from './types';

/** Lifecycle statuses a tracked task can be in. */
export type TrackedTaskStatus =
	| 'PENDING'
	| 'OFFERED'
	| 'ASSIGNED'
	| 'IN_PROGRESS'
	| 'COMPLETED'
	| 'FAILED'
	| 'CANCELLED';

/** Where the socket is, from the app's point of view. */
export type TrackerConnection = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'offline';

/** The rider's last reported position. */
export interface TrackedRider {
	riderId: string | null;
	latitude: number;
	longitude: number;
	bearing: number | null;
	speed: number | null;
	/** When the rider reported this position (ISO 8601). */
	at: string;
}

/**
 * The rider's ETA to the stop they are heading to. Same shape as `liveEta` on
 * `GET /v1/sdk/tasks/{taskId}`, so a server-side read can seed the tracker.
 */
export interface TrackedEta {
	stageIndex: number;
	/** Driving time left when the rider last reported, in seconds. */
	seconds: number;
	/** Road distance left when the rider last reported, in metres. */
	meters: number;
	/** When the rider is expected at the stop (ISO 8601). Count down to this. */
	arrivesAt: string;
	/** When the rider last reported this (ISO 8601). */
	updatedAt: string;
}

/** One lifecycle event, newest first in `TaskTrackerState.events`. */
export interface TrackedEvent {
	type: EventType;
	/** When it happened, from the event when it says, otherwise when it arrived (ISO 8601). */
	at: string;
	payload: Record<string, unknown>;
}

export interface TaskTrackerState {
	taskId: string;
	connection: TrackerConnection;
	/** Latest known status, or null until the first event or `initial.status`. */
	status: TrackedTaskStatus | null;
	/** The stage the rider is working on, when known. */
	currentStageIndex: number | null;
	rider: TrackedRider | null;
	/** The rider's road ETA to their next stop, or null when there isn't one. */
	eta: TrackedEta | null;
	/** Lifecycle events seen while tracking, newest first (location updates excluded). */
	events: TrackedEvent[];
	/** True once the task is COMPLETED, FAILED or CANCELLED. */
	finished: boolean;
	error: Error | null;
}

export interface TaskTrackerOptions {
	/** Seed state from your own task read, so the UI isn't empty before the first event. */
	initial?: {
		status?: TrackedTaskStatus | null;
		currentStageIndex?: number | null;
		/** `liveEta` from `GET /v1/sdk/tasks/{taskId}`. */
		eta?: TrackedEta | null;
	};
	/** How many lifecycle events to keep (default 50). */
	maxEvents?: number;
}

export interface TaskTracker {
	getState(): TaskTrackerState;
	/** Called on every change. Returns a function that unsubscribes. */
	subscribe(listener: (state: TaskTrackerState) => void): () => void;
	/** Start listening to the task. Safe to call more than once. */
	start(): Promise<void>;
	/** Stop listening and remove handlers. The client itself stays connected. */
	stop(): Promise<void>;
}

const LIFECYCLE: Partial<Record<EventType, TrackedTaskStatus>> = {
	TASK_OFFERED: 'OFFERED',
	TASK_ASSIGNED: 'ASSIGNED',
	TASK_IN_PROGRESS: 'IN_PROGRESS',
	STAGE_COMPLETED: undefined,
	TASK_COMPLETED: 'COMPLETED',
	TASK_FAILED: 'FAILED',
	TASK_CANCELLED: 'CANCELLED',
};
const TERMINAL = new Set<TrackedTaskStatus>(['COMPLETED', 'FAILED', 'CANCELLED']);

/** Turns a location event's `eta` into an absolute arrival time. */
export function toTrackedEta(eta: RiderRouteEta | undefined | null, reportedAt: string | undefined): TrackedEta | null {
	if (!eta || typeof eta.seconds !== 'number' || typeof eta.stageIndex !== 'number') return null;
	const reported = reportedAt ? Date.parse(reportedAt) : Date.now();
	const base = Number.isFinite(reported) ? reported : Date.now();
	return {
		stageIndex: eta.stageIndex,
		seconds: Math.round(eta.seconds),
		meters: Math.round(eta.meters),
		arrivesAt: new Date(base + eta.seconds * 1000).toISOString(),
		updatedAt: new Date(base).toISOString(),
	};
}

/**
 * Track one task with an existing realtime client.
 *
 * @example
 * ```typescript
 * const tracker = createTaskTracker(relay, taskId);
 * tracker.subscribe((s) => render(s.status, s.rider, s.eta));
 * await tracker.start();
 * ```
 */
export function createTaskTracker(
	client: RelayRealtimeClient,
	taskId: string,
	options: TaskTrackerOptions = {},
): TaskTracker {
	const maxEvents = options.maxEvents ?? 50;
	const listeners = new Set<(state: TaskTrackerState) => void>();
	let offs: Array<() => void> = [];
	let started = false;
	let state: TaskTrackerState = {
		taskId,
		connection: 'idle',
		status: options.initial?.status ?? null,
		currentStageIndex: options.initial?.currentStageIndex ?? null,
		rider: null,
		eta: options.initial?.eta ?? null,
		events: [],
		finished: options.initial?.status ? TERMINAL.has(options.initial.status) : false,
		error: null,
	};

	const set = (patch: Partial<TaskTrackerState>) => {
		state = { ...state, ...patch };
		for (const listener of listeners) listener(state);
	};

	const forThisTask = (payload: any) => !payload?.taskId || payload.taskId === taskId;

	function onLifecycle(type: EventType, payload: any) {
		if (!forThisTask(payload)) return;
		const status = LIFECYCLE[type] ?? state.status;
		const finished = status ? TERMINAL.has(status) : false;
		const stageIndex =
			typeof payload?.currentStageIndex === 'number'
				? payload.currentStageIndex
				: typeof payload?.nextStageIndex === 'number'
					? payload.nextStageIndex
					: state.currentStageIndex;
		const at =
			payload?.timestamp ??
			payload?.completedAt ??
			payload?.cancelledAt ??
			payload?.failedAt ??
			payload?.assignedAt ??
			payload?.startedAt ??
			payload?.offeredAt ??
			new Date().toISOString();
		set({
			status,
			finished,
			currentStageIndex: stageIndex,
			// The ETA belongs to a stop; drop it once the task moves on or ends.
			eta: finished || (state.eta && stageIndex !== null && state.eta.stageIndex !== stageIndex) ? null : state.eta,
			events: [{ type, at: String(at), payload }, ...state.events].slice(0, maxEvents),
		});
	}

	function onLocation(payload: any) {
		if (!forThisTask(payload) || !payload?.location) return;
		const location = payload.location;
		const at = typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString();
		set({
			connection: 'live',
			rider: {
				riderId: payload.riderId ?? null,
				latitude: Number(location.latitude),
				longitude: Number(location.longitude),
				bearing: typeof location.bearing === 'number' ? location.bearing : (location.heading ?? null),
				speed: typeof location.speed === 'number' ? location.speed : null,
				at,
			},
			eta: payload.eta ? toTrackedEta(payload.eta, at) : state.eta,
		});
	}

	return {
		getState: () => state,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		async start() {
			if (started) return;
			started = true;
			offs = [
				client.on('CONNECTION_OPEN', () => set({ connection: 'live', error: null })),
				client.on('CONNECTION_RECONNECTING', () => set({ connection: 'reconnecting' })),
				client.on('CONNECTION_CLOSE', () => set({ connection: state.finished ? 'idle' : 'offline' })),
				client.on('CONNECTION_ERROR', (e) => set({ connection: 'offline', error: e.error })),
				client.on('RIDER_LOCATION_UPDATE', onLocation),
				...(Object.keys(LIFECYCLE) as EventType[]).map((type) =>
					client.on(type, (payload: unknown) => onLifecycle(type, payload)),
				),
			];
			set({ connection: 'connecting', error: null });
			try {
				await client.listen(taskId);
				if (state.connection === 'connecting') set({ connection: 'live' });
			} catch (error) {
				set({ connection: 'offline', error: error instanceof Error ? error : new Error(String(error)) });
			}
		},
		async stop() {
			if (!started) return;
			started = false;
			for (const off of offs) off();
			offs = [];
			try {
				await client.stopListening(taskId);
			} finally {
				set({ connection: 'idle' });
			}
		},
	};
}
