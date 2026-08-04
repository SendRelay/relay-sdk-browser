import { describe, expect, it, vi } from 'vitest';
import { RelayRealtimeClient } from './client';

describe('RelayRealtimeClient message parsing', () => {
  it('uses api.sendrelay.com.ng as default websocket endpoint', () => {
    const client = new RelayRealtimeClient({
      getToken: async () => 'token',
    });

    expect((client as any).options.url).toBe('https://api.sendrelay.com.ng/v1/realtime/ws');
  });

  it('unwraps TASK_UPDATE envelope and emits inner business event payload', () => {
    const client = new RelayRealtimeClient({
      getToken: async () => 'token',
    });

    const handler = vi.fn();
    client.on('TASK_ASSIGNED', handler);

    (client as any).handleIncomingMessage({
      type: 'TASK_UPDATE',
      data: {
        type: 'TASK_ASSIGNED',
        taskId: 'task-123',
        riderId: 'rider-456',
        developerId: 'dev-789',
        status: 'ASSIGNED',
        assignedAt: '2026-05-14T10:00:00.000Z',
        deliveryFee: 500000,
        currentStageIndex: 0,
        timestamp: '2026-05-14T10:00:01.000Z',
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TASK_ASSIGNED',
        taskId: 'task-123',
        riderId: 'rider-456',
        developerId: 'dev-789',
        status: 'ASSIGNED',
      }),
    );
  });

  it('unwraps wrapped RIDER_LOCATION_UPDATE data payloads', () => {
    const client = new RelayRealtimeClient({
      getToken: async () => 'token',
    });

    const handler = vi.fn();
    client.on('RIDER_LOCATION_UPDATE', handler);

    (client as any).handleIncomingMessage({
      type: 'RIDER_LOCATION_UPDATE',
      data: {
        riderId: 'rider-456',
        taskId: 'task-123',
        location: {
          latitude: 6.5244,
          longitude: 3.3792,
          bearing: null,
          speed: null,
          accuracy: 12.5,
        },
        timestamp: '2026-05-14T10:01:00.000Z',
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        riderId: 'rider-456',
        taskId: 'task-123',
        location: expect.objectContaining({
          latitude: 6.5244,
          longitude: 3.3792,
        }),
      }),
    );
  });

  it('emits NEW_TASK_OFFER with nested task payload intact', () => {
    const client = new RelayRealtimeClient({
      getToken: async () => 'token',
    });

    const handler = vi.fn();
    client.on('NEW_TASK_OFFER', handler);

    (client as any).handleIncomingMessage({
      type: 'NEW_TASK_OFFER',
      taskId: 'task-999',
      tier: 2,
      task: {
        taskId: 'task-999',
        taskType: 'PACKAGE_DELIVERY',
        priority: 'URGENT',
        deliveryFee: 250000,
        stages: [
          {
            type: 'PICKUP',
            location: {
              latitude: 6.5244,
              longitude: 3.3792,
            },
          },
        ],
        pickupLocation: {
          latitude: 6.5244,
          longitude: 3.3792,
        },
        pickupAddress: '123 Main St',
        dropoffCount: 1,
      },
      offerExpiresAt: '2026-05-14T10:05:00.000Z',
      offerTimeoutSeconds: 30,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'NEW_TASK_OFFER',
        taskId: 'task-999',
        tier: 2,
        offerTimeoutSeconds: 30,
        task: expect.objectContaining({
          taskType: 'PACKAGE_DELIVERY',
          priority: 'URGENT',
          deliveryFee: 250000,
          dropoffCount: 1,
        }),
      }),
    );
  });
});
