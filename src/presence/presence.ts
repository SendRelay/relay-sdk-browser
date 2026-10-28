/**
 * Rider presence map helpers
 *
 * Presence is fetched with an API key (`GET /v1/sdk/presence`, or `relay.presence.get()` in
 * @relay-sdk/sdk-node), so browsers get it through your backend, exactly like realtime tokens.
 * Responses are cached by Relay for `refreshAfterSeconds`; your backend can cache them too.
 *
 * @module presence
 */

export type PresenceResolution = 'BLOCK' | 'NEIGHBOURHOOD' | 'DISTRICT';
export type PresenceDensity = 'LOW' | 'MEDIUM' | 'HIGH';
export type PresenceVehicleType =
	| 'BICYCLE'
	| 'BIKE'
	| 'MOTORCYCLE'
	| 'TRICYCLE'
	| 'CAR'
	| 'VAN'
	| 'TRUCK';

export interface PresencePoint {
	latitude: number;
	longitude: number;
}

/** One map cell with available riders. Riders are never identified. */
export interface PresenceCell {
	/** H3 cell index */
	cellId: string;
	/** Coarser than requested where too few riders were present to show finer cells */
	resolution: PresenceResolution;
	h3Resolution: number;
	center: PresencePoint;
	/** Closed polygon outline (first point repeated last) */
	boundary: PresencePoint[];
	/** `LOW` 1–2 riders, `MEDIUM` 3–5, `HIGH` 6 or more */
	density: PresenceDensity;
	vehicleTypes: PresenceVehicleType[];
}

/** Response of `GET /v1/sdk/presence` */
export interface PresenceResponse {
	mode: 'live' | 'test';
	/** Test keys receive simulated riders */
	simulated: boolean;
	resolution: PresenceResolution;
	h3Resolution: number;
	area: { center: PresencePoint; radiusKm: number };
	cells: PresenceCell[];
	totals: {
		availableRiders: number;
		byVehicleType: Record<PresenceVehicleType, number>;
	};
	minRidersPerCell: number;
	capped: boolean;
	generatedAt: string;
	refreshAfterSeconds: number;
}

/** GeoJSON (RFC 7946) polygon feature for one presence cell */
export interface PresenceFeature {
	type: 'Feature';
	id: string;
	geometry: { type: 'Polygon'; coordinates: [number, number][][] };
	properties: {
		cellId: string;
		resolution: PresenceResolution;
		density: PresenceDensity;
		vehicleTypes: PresenceVehicleType[];
	};
}

export interface PresenceFeatureCollection {
	type: 'FeatureCollection';
	features: PresenceFeature[];
}

/**
 * Converts a presence response into GeoJSON for Mapbox/MapLibre, Leaflet or a Google Maps data
 * layer. Optionally keep only cells offering one of `vehicleTypes`.
 *
 * @example
 * ```typescript
 * const presence = await fetch('/api/relay/presence?lat=6.5244&lng=3.3792').then((r) => r.json());
 * map.getSource('riders').setData(presenceToGeoJSON(presence, { vehicleTypes: ['MOTORCYCLE'] }));
 * // Style by density: ['match', ['get', 'density'], 'HIGH', 0.6, 'MEDIUM', 0.4, 0.2]
 * ```
 */
export function presenceToGeoJSON(
	presence: Pick<PresenceResponse, 'cells'>,
	options: { vehicleTypes?: PresenceVehicleType[] } = {},
): PresenceFeatureCollection {
	const wanted = options.vehicleTypes?.length ? new Set(options.vehicleTypes) : null;
	return {
		type: 'FeatureCollection',
		features: presence.cells
			.filter((cell) => !wanted || cell.vehicleTypes.some((type) => wanted.has(type)))
			.map((cell) => ({
				type: 'Feature',
				id: cell.cellId,
				geometry: {
					type: 'Polygon',
					// GeoJSON is [longitude, latitude].
					coordinates: [cell.boundary.map((point): [number, number] => [point.longitude, point.latitude])],
				},
				properties: {
					cellId: cell.cellId,
					resolution: cell.resolution,
					density: cell.density,
					vehicleTypes: cell.vehicleTypes,
				},
			})),
	};
}
