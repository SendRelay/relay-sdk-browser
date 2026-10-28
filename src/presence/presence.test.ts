import { describe, expect, it } from 'vitest';
import { presenceToGeoJSON, type PresenceCell } from './presence';

const cell = (cellId: string, vehicleTypes: PresenceCell['vehicleTypes']): PresenceCell => ({
	cellId,
	resolution: 'BLOCK',
	h3Resolution: 9,
	center: { latitude: 6.5, longitude: 3.4 },
	boundary: [
		{ latitude: 6.5, longitude: 3.4 },
		{ latitude: 6.51, longitude: 3.41 },
		{ latitude: 6.5, longitude: 3.42 },
		{ latitude: 6.5, longitude: 3.4 },
	],
	density: 'MEDIUM',
	vehicleTypes,
});

describe('presenceToGeoJSON', () => {
	it('emits one [lng, lat] polygon per cell', () => {
		const geojson = presenceToGeoJSON({ cells: [cell('a', ['MOTORCYCLE'])] });
		expect(geojson.features).toHaveLength(1);
		expect(geojson.features[0]?.geometry.coordinates[0]?.[1]).toEqual([3.41, 6.51]);
		expect(geojson.features[0]?.properties).toMatchObject({ cellId: 'a', density: 'MEDIUM' });
	});

	it('keeps only cells offering the requested vehicle types', () => {
		const geojson = presenceToGeoJSON(
			{ cells: [cell('a', ['MOTORCYCLE']), cell('b', ['CAR', 'VAN'])] },
			{ vehicleTypes: ['CAR'] },
		);
		expect(geojson.features.map((feature) => feature.id)).toEqual(['b']);
	});
});
