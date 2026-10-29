/**
 * Runs the shared realtime conformance fixtures (packages/sdks/conformance) against this SDK.
 * Every Relay UI SDK runs the same fixtures, which is how they stay at parity.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RelayRealtimeClient } from './client';
import { HeartbeatManager } from './connection/heartbeat';
import { buildRelayWebSocketUrl } from './connection/websocket_url';

const dir = process.env.RELAY_CONFORMANCE_DIR ?? path.resolve(__dirname, '../../conformance');
const available = fs.existsSync(path.join(dir, 'manifest.json'));
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

const lookup = (value: unknown, dotted: string) =>
	dotted.split('.').reduce<any>((node, key) => (node == null ? undefined : node[key]), value);

const newClient = () => new RelayRealtimeClient({ getToken: async () => 'token' });

describe.skipIf(!available)('conformance', () => {
	if (!available) return;
	const manifest = read('manifest.json');
	const url = read('realtime/url.json');
	const outgoing = read('realtime/outgoing.json');

	describe('frames', () => {
		for (const c of read('realtime/frames.json').cases) {
			it(c.name, () => {
				const client = newClient();
				const seen: Array<{ event: string; payload: any }> = [];
				for (const event of manifest.realtime.events) {
					client.on(event, (payload: any) => seen.push({ event, payload }));
				}
				(client as any).handleIncomingMessage(c.frame);

				if (c.expect.event === null) {
					expect(seen).toEqual([]);
					return;
				}
				expect(seen.map((s) => s.event)).toEqual([c.expect.event]);
				for (const [key, want] of Object.entries(c.expect.fields ?? {})) {
					const got = lookup(seen[0]!.payload, key);
					if (want === null) expect(got ?? null, key).toBeNull();
					else expect(got, key).toEqual(want);
				}
			});
		}
	});

	describe('url', () => {
		for (const c of url.cases) {
			it(c.name, () => {
				const built = new URL(buildRelayWebSocketUrl({ token: c.token, baseUrl: c.baseUrl, deviceId: c.deviceId }));
				expect(built.protocol.replace(':', '')).toBe(c.expect.scheme);
				expect(built.hostname).toBe(c.expect.host);
				expect(built.port ? Number(built.port) : null).toBe(c.expect.port);
				expect(built.pathname).toBe(c.expect.path);
				expect(Object.fromEntries(built.searchParams)).toEqual(c.expect.query);
			});
		}

		it('uses the shared defaults', () => {
			const options = (newClient() as any).options;
			const d = url.defaults;
			expect(options.url).toBe(d.url);
			expect(options.reconnect).toMatchObject({
				enabled: d.reconnect.enabled,
				initialDelayMs: d.reconnect.initialDelayMs,
				maxDelayMs: d.reconnect.maxDelayMs,
				backoffMultiplier: d.reconnect.backoffMultiplier,
			});
			expect(options.heartbeat).toEqual(d.heartbeat);
			expect(options.tokenExpirationWarningMs).toBe(d.tokenRefreshBeforeExpiryMs);
		});

		it('names a device even when the app does not pass one', () => {
			expect((newClient() as any).options.deviceId).toMatch(/\S+/);
			expect(new RelayRealtimeClient({ getToken: () => 't', deviceId: 'kiosk-1' }) as any).toHaveProperty(
				'options.deviceId',
				'kiosk-1',
			);
		});
	});

	describe('outgoing', () => {
		const withTask = (message: Record<string, string>, taskId: string) =>
			JSON.parse(JSON.stringify(message).replace('<taskId>', taskId));

		it('subscribe and unsubscribe', async () => {
			const client = newClient() as any;
			const send = vi.fn(async () => {});
			client.connection.send = send;
			await client.subscribeToTask('task-1');
			await client.unsubscribeFromTask('task-1');
			expect(send.mock.calls.map((call: unknown[]) => call[0])).toEqual([
				withTask(outgoing.messages.subscribe, 'task-1'),
				withTask(outgoing.messages.unsubscribe, 'task-1'),
			]);
		});

		it('ping', () => {
			vi.useFakeTimers();
			const ws = { send: vi.fn() };
			const heartbeat = new HeartbeatManager(ws as unknown as WebSocket, 1000, 500, () => {});
			heartbeat.start();
			vi.advanceTimersByTime(1000);
			heartbeat.stop();
			vi.useRealTimers();
			expect(ws.send).toHaveBeenCalledWith(JSON.stringify(outgoing.messages.ping));
		});
	});
});
