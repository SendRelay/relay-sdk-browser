/**
 * Event types and payloads for the SendRelay browser SDK
 *
 * @module types/events
 */

/**
 * All event types (25 total: 20 business + 5 connection)
 */
export type EventType =
	// Task lifecycle events
	| 'TASK_CREATED'
	| 'TASK_DISPATCH_STARTED'
	| 'TASK_SEARCHING'
	| 'TASK_RIDERS_NEARBY'
	| 'TASK_OFFERED'
	| 'TASK_ASSIGNED'
	| 'TASK_IN_PROGRESS'
	| 'TASK_COMPLETED'
	| 'TASK_FAILED'
	| 'TASK_CANCELLED'
	| 'STAGE_COMPLETED'
	| 'STAGE_ARRIVED'
	| 'TASK_DETAILS_UPDATED'
	| 'TASK_RIDER_UNASSIGNED'
	// Payment events
	| 'PAYMENT_PENDING'
	| 'PAYMENT_RELEASED'
	| 'PAYMENT_DISPUTED'
	| 'PAYMENT_DISPUTE_RESOLVED'
	// Real-time events
	| 'RIDER_LOCATION_UPDATE'
	| 'NEW_TASK_OFFER'
	// Connection events
	| 'CONNECTION_OPEN'
	| 'CONNECTION_CLOSE'
	| 'CONNECTION_ERROR'
	| 'CONNECTION_RECONNECTING'
	| 'TOKEN_EXPIRING';

/**
 * Location coordinates
 */
export interface Location {
	latitude: number;
	longitude: number;
	address?: string;
	bearing?: number | null;
	speed?: number | null;
	accuracy?: number | null;
	heading?: number | null;
	altitude?: number | null;
}

/**
 * Task stage information
 */
export interface Stage {
	type: 'PICKUP' | 'DROPOFF';
	location: {
		latitude: number;
		longitude: number;
		address?: string;
	};
	status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
	completedAt?: string;
}

/**
 * Task created event payload
 */
export interface TaskCreatedEvent {
	taskId: string;
	developerId: string;
	taskType: 'PASSENGER_RIDE' | 'FOOD_DELIVERY' | 'PACKAGE_DELIVERY' | 'BULK_DELIVERY' | 'ERRAND';
	priority: 'STANDARD' | 'URGENT';
	deliveryFee: number;
	totalFee: number;
	stages: Stage[];
	createdAt: string;
}

/**
 * A booked (dispatch SCHEDULED) task's search opened: SendRelay is now looking for a rider
 */
export interface TaskDispatchStartedEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	developerId: string;
	status: 'PENDING';
	pickupAt: string;
	searchExpiresAt: string;
	startedAt: string;
}

/**
 * The task keeps looking for a rider after its first offers, until `searchExpiresAt`
 */
export interface TaskSearchingEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	developerId: string;
	status: 'SEARCHING';
	strategy: 'WAIT_FOR_RIDER' | 'SCHEDULED' | (string & {});
	searchExpiresAt: string;
	searchingAt: string;
}

/**
 * Manual tasks (autoAssign false) still waiting: eligible riders are near the pickup. A count
 * only, at most every few minutes; fetch available riders to offer the task to them.
 */
/** The rider reached a stop (inside its geofence), once per stop. */
export interface StageArrivedEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	developerId: string;
	riderId: string;
	stageIndex: number;
	stageType: 'PICKUP' | 'DROPOFF';
	arrivedAt: string;
}

/** The business edited notes, instructions or a stop's contact. Read the task for the new values. */
export interface TaskDetailsUpdatedEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	changed: string[];
	stageIndexes: number[];
	timestamp: string;
}

/**
 * The rider cancelled before pickup and SendRelay is finding another
 * (`dispatch.onRiderCancel: 'FIND_ANOTHER'` only). The task is PENDING again.
 */
export interface TaskRiderUnassignedEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	riderId: string;
	reason: string;
	status: 'PENDING';
	researchesLeft: number;
	timestamp: string;
}

export interface TaskRidersNearbyEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	developerId: string;
	ridersNearby: number;
	detectedAt: string;
}

/**
 * Task offered event payload
 */
export interface TaskOfferedEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	developerId: string;
	status: 'OFFERED';
	tier: number;
	ridersOffered: number;
	offerId?: string;
	offeredAt: string;
}

/**
 * Task assigned event payload
 */
export interface TaskAssignedEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	riderId: string;
	developerId: string;
	status: 'ASSIGNED';
	assignedAt: string;
	deliveryFee: number;
	currentStageIndex: number;
}

/**
 * Task in progress event payload
 */
export interface TaskInProgressEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	riderId: string;
	developerId: string;
	status: 'IN_PROGRESS';
	currentStageIndex: number;
	startedAt: string;
}

/**
 * Task completed event payload
 */
export interface TaskCompletedEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	riderId: string;
	developerId: string;
	status: 'COMPLETED';
	completedAt: string;
	deliveryFee: number;
	paymentStatus?: 'PENDING' | 'RELEASED';
	/** True when the task had a completion code and the rider entered it */
	completionCodeVerified?: boolean;
}

/**
 * Task failed event payload
 */
export interface TaskFailedEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	developerId: string;
	riderId?: string;
	status: 'FAILED';
	failedAt: string;
	reason: string;
	failedStageIndex?: number;
	refunded: boolean;
	refundAmount: number;
}

/**
 * Task cancelled event payload
 */
export interface TaskCancelledEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	developerId: string;
	riderId?: string | null;
	cancelledBy?: 'DEVELOPER' | 'RIDER';
	status: 'CANCELLED';
	cancelledAt: string;
	reason?: string;
}

/**
 * Stage completed event payload
 */
export interface StageCompletedEvent {
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	riderId: string;
	developerId: string;
	stageIndex: number;
	stage: {
		type: 'PICKUP' | 'DROPOFF';
		status: 'COMPLETED';
		completedAt: string;
		completionPhoto?: string;
		completionNotes?: string;
	};
	nextStageIndex?: number;
	totalStages: number;
	timestamp?: string;
}

/**
 * Payment pending event payload
 */
export interface PaymentPendingEvent {
	transactionId: string;
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	developerId: string;
	riderId: string;
	amount: number;
	status: 'PENDING';
	releaseAt: string;
	disputeWindowHours: number;
}

/**
 * Payment released event payload
 */
export interface PaymentReleasedEvent {
	transactionId: string;
	taskId: string;
	/** The task's revision after this event, as on webhooks and task reads. The client drops frames older than one it already delivered for the task. */
	revision?: number;
	developerId: string;
	riderId: string;
	amount: number;
	status: 'RELEASED';
	releasedAt: string;
}

/**
 * Payment disputed event payload
 */
export interface PaymentDisputedEvent {
	disputeId: string;
	transactionId: string;
	taskId: string;
	developerId: string;
	riderId: string;
	amount: number;
	reason: string;
	description: string;
	status: 'PENDING_REVIEW';
	disputedAt: string;
}

/**
 * Payment dispute resolved event payload
 */
export interface PaymentDisputeResolvedEvent {
	disputeId: string;
	transactionId: string;
	taskId: string;
	developerId: string;
	riderId?: string;
	resolution: 'DEVELOPER' | 'RIDER' | 'SPLIT';
	refundAmount: number;
	riderPayment: number;
	resolvedAt: string;
	resolvedBy: string;
	notes?: string;
}

/**
 * Rider location update event payload
 */
export interface RiderLocationUpdateEvent {
	riderId: string;
	taskId: string;
	location: Location;
	/**
	 * The rider's ETA to the stop they are heading to, from their navigation route and live
	 * traffic. Missing when the rider's app hasn't reported one.
	 */
	eta?: RiderRouteEta;
	timestamp?: string;
}

/**
 * The rider's remaining time and road distance to a stop, as of the location update
 */
export interface RiderRouteEta {
	/** Index of the stage the rider is heading to */
	stageIndex: number;
	/** Driving time left, in seconds (count down from the update's `timestamp`) */
	seconds: number;
	/** Road distance left, in metres */
	meters: number;
}

/**
 * New task offer event payload (sent to riders)
 */
export interface NewTaskOfferEvent {
	taskId: string;
	tier: number;
	task: {
		taskId: string;
		taskType: string;
		priority: string;
		deliveryFee: number;
		stages: Stage[];
		pickupLocation: Location;
		pickupAddress?: string;
		dropoffCount: number;
	};
	offerExpiresAt: string;
	offerTimeoutSeconds: number;
}

/**
 * Connection open event payload
 */
export interface ConnectionOpenEvent {
	state: 'connected';
	timestamp?: string;
}

/**
 * Connection close event payload
 */
export interface ConnectionCloseEvent {
	state: 'disconnected';
	code?: number;
	reason?: string;
	timestamp?: string;
}

/**
 * Connection error event payload
 */
export interface ConnectionErrorEvent {
	error: Error;
	timestamp?: string;
}

/**
 * Connection reconnecting event payload
 */
export interface ConnectionReconnectingEvent {
	attempt: number;
	delay?: number;
	timestamp?: string;
}

/**
 * Token expiring event payload
 */
export interface TokenExpiringEvent {
	expiresAt: string;
	expiresIn: number; // milliseconds
	warningMs?: number; // alias for older consumers
	timestamp?: string;
}

/**
 * Event payload map
 */
export interface EventPayloadMap {
	TASK_CREATED: TaskCreatedEvent;
	TASK_DISPATCH_STARTED: TaskDispatchStartedEvent;
	TASK_SEARCHING: TaskSearchingEvent;
	TASK_RIDERS_NEARBY: TaskRidersNearbyEvent;
	TASK_OFFERED: TaskOfferedEvent;
	TASK_ASSIGNED: TaskAssignedEvent;
	TASK_IN_PROGRESS: TaskInProgressEvent;
	TASK_COMPLETED: TaskCompletedEvent;
	TASK_FAILED: TaskFailedEvent;
	TASK_CANCELLED: TaskCancelledEvent;
	STAGE_COMPLETED: StageCompletedEvent;
	STAGE_ARRIVED: StageArrivedEvent;
	TASK_DETAILS_UPDATED: TaskDetailsUpdatedEvent;
	TASK_RIDER_UNASSIGNED: TaskRiderUnassignedEvent;
	PAYMENT_PENDING: PaymentPendingEvent;
	PAYMENT_RELEASED: PaymentReleasedEvent;
	PAYMENT_DISPUTED: PaymentDisputedEvent;
	PAYMENT_DISPUTE_RESOLVED: PaymentDisputeResolvedEvent;
	RIDER_LOCATION_UPDATE: RiderLocationUpdateEvent;
	NEW_TASK_OFFER: NewTaskOfferEvent;
	CONNECTION_OPEN: ConnectionOpenEvent;
	CONNECTION_CLOSE: ConnectionCloseEvent;
	CONNECTION_ERROR: ConnectionErrorEvent;
	CONNECTION_RECONNECTING: ConnectionReconnectingEvent;
	TOKEN_EXPIRING: TokenExpiringEvent;
}

/**
 * Event handler function
 */
export type EventHandler<T extends EventType = EventType> = (
	payload: EventPayloadMap[T]
) => void;
