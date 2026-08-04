/**
 * Event types and payloads for the Relay browser SDK
 *
 * @module types/events
 */

/**
 * All event types (19 total: 14 business + 5 connection)
 */
export type EventType =
	// Task lifecycle events
	| 'TASK_CREATED'
	| 'TASK_OFFERED'
	| 'TASK_ASSIGNED'
	| 'TASK_IN_PROGRESS'
	| 'TASK_COMPLETED'
	| 'TASK_FAILED'
	| 'TASK_CANCELLED'
	| 'STAGE_COMPLETED'
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
 * Task offered event payload
 */
export interface TaskOfferedEvent {
	taskId: string;
	developerId: string;
	status: 'OFFERED';
	tier: number;
	ridersOffered: number;
	offeredAt: string;
}

/**
 * Task assigned event payload
 */
export interface TaskAssignedEvent {
	taskId: string;
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
	riderId: string;
	developerId: string;
	status: 'COMPLETED';
	completedAt: string;
	deliveryFee: number;
	paymentStatus?: 'PENDING' | 'RELEASED';
}

/**
 * Task failed event payload
 */
export interface TaskFailedEvent {
	taskId: string;
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
	developerId: string;
	riderId?: string;
	status: 'CANCELLED';
	cancelledAt: string;
	reason?: string;
}

/**
 * Stage completed event payload
 */
export interface StageCompletedEvent {
	taskId: string;
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
}

/**
 * Payment pending event payload
 */
export interface PaymentPendingEvent {
	transactionId: string;
	taskId: string;
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
	timestamp?: string;
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
	TASK_OFFERED: TaskOfferedEvent;
	TASK_ASSIGNED: TaskAssignedEvent;
	TASK_IN_PROGRESS: TaskInProgressEvent;
	TASK_COMPLETED: TaskCompletedEvent;
	TASK_FAILED: TaskFailedEvent;
	TASK_CANCELLED: TaskCancelledEvent;
	STAGE_COMPLETED: StageCompletedEvent;
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
