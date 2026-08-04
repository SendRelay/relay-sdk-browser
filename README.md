# Relay Browser SDK

[![npm version](https://badge.fury.io/js/%40relay-sdk%2Fsdk-browser.svg)](https://www.npmjs.com/package/@relay-sdk/sdk-browser)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
**🌐 Browser SDK** | WebSocket Client

Official Browser SDK for the [Relay](https://sendrelay.com.ng) delivery platform. This is a **client-side SDK** designed for frontend web applications.

> **ℹ️ Client-Side SDK:** This SDK uses WebSocket tokens (not API keys) for secure client authentication. Tokens must be provisioned by your backend using [@relay-sdk/sdk-node](../sdk-node) (Server SDK).

## Features

- ✅ **Automatic Token Provisioning**: SDK fetches tokens via callback - no manual management
- ✅ **Automatic Token Refresh**: Tokens refreshed before expiration - zero downtime
- ✅ **Connection Pooling**: Subscriptions preserved across token refresh and reconnection
- ✅ **Real-time Updates**: Subscribe to task lifecycle events and rider location updates
- ✅ **Automatic Reconnection**: Exponential backoff reconnection (1s → 30s)
- ✅ **Offline Support**: Message queuing when disconnected (max 100 messages)
- ✅ **Type-Safe**: Full TypeScript support with 19+ event types
- ✅ **Event-Driven**: Clean EventEmitter-based API
- ✅ **Framework Agnostic**: Works with React, Vue, Angular, Svelte, or vanilla JS

## Usage Context

### Browser SDK (Frontend Web Applications)

This SDK is designed for **client-side browser applications** and provides:

- ✅ **Real-time WebSocket connection** for live task updates
- ✅ **Automatic token provisioning** via backend callback
- ✅ **19+ event types** for complete task lifecycle tracking
- ✅ **Auto-reconnection** with exponential backoff
- ✅ **Token auto-refresh** before expiration
- ✅ **Offline message queuing**
- ✅ **Framework agnostic** (React, Vue, Angular, Svelte, vanilla JS)

**Typical Use Cases:**
- Real-time delivery tracking in web apps
- Customer-facing order status pages
- Live rider location updates on maps
- Task status notifications
- Payment status monitoring

**Security Model:**
This SDK uses **temporary WebSocket tokens** instead of API keys. Your backend (using @relay-sdk/sdk-node) generates these tokens with limited scope and expiration:

```typescript
// Backend (Node.js) - Generate token
const { token } = await relay.auth.createWebSocketToken({
  scope: ['task:task-123'],
  expiresIn: 3600, // 1 hour
});

// Frontend (Browser) - Use token
const relay = new RelayRealtimeClient({
  getToken: async (taskIds) => {
    const res = await fetch('/api/relay/token', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });
    return (await res.json()).token;
  },
});
```

### Server-Side Alternative

For server-side task creation and management:
- **Node.js backend:** Use [@relay-sdk/sdk-node](https://github.com/SendRelay/relay-sdk-node) - REST API client with full access

### Mobile Alternative

For mobile applications:
- **Flutter apps:** Use [relay_flutter](https://github.com/SendRelay/relay-sdk-flutter) - WebSocket client for iOS/Android/Web/Desktop

## Installation

```bash
npm install @relay-sdk/sdk-browser
```

## Quick Start

### 1. Set Up Backend Token Endpoint

Create an endpoint in your backend that exchanges your API key for a scoped session token:

```typescript
// Backend (Express.js with @relay-sdk/sdk-node)
import { RelayClient } from '@relay-sdk/sdk-node';
import express from 'express';

const app = express();
app.use(express.json());
const relay = new RelayClient({ apiKey: process.env.RELAY_API_KEY });

app.post('/api/relay/token', async (req, res) => {
  const { taskIds } = req.body;  // Array of task IDs
  const userId = req.session.userId; // Your auth

  // Verify user owns tasks
  const tasks = await db.tasks.findMany({
    where: { id: { in: taskIds }, userId },
  });

  if (tasks.length !== taskIds.length) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Create scoped token
  const { token } = await relay.auth.createWebSocketToken({
    scope: taskIds.map(id => `task:${id}`),
    expiresIn: 1800, // 30 minutes
  });

  res.json({ token });
});
```

See **[WEBSOCKET_AUTH.md](https://github.com/SendRelay/relay-sdk-node/blob/main/WEBSOCKET_AUTH.md)** for complete backend setup guide.

### 2. Listen to Task Updates in Browser

```typescript
import { RelayRealtimeClient } from '@relay-sdk/sdk-browser';

// Initialize client with token callback
const relay = new RelayRealtimeClient({
  getToken: async (taskIds) => {
    // SDK calls this when it needs a token
    const res = await fetch('/api/relay/token', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });
    return (await res.json()).token;
  },
});

// Listen to task (auto-connects, auto-fetches token)
await relay.listen('task-123');

// Register event handlers
relay.on('TASK_ASSIGNED', (event) => {
  console.log('Task assigned to rider:', event.riderId);
});

relay.on('RIDER_LOCATION_UPDATE', (event) => {
  console.log('Rider location:', event.location);
  updateMapMarker(event.location);
});

relay.on('TASK_COMPLETED', (event) => {
  console.log('Task completed!', event);
  showSuccessMessage();
});
```

That's it! The SDK handles:
- ✅ Token fetching via your callback
- ✅ WebSocket connection
- ✅ Task subscription
- ✅ Automatic token refresh before expiration
- ✅ Subscription preservation across reconnections

## Examples

### React Example

```tsx
import { useState, useEffect } from 'react';
import { RelayRealtimeClient } from '@relay-sdk/sdk-browser';

function TaskTracker({ taskId }: { taskId: string }) {
  const [status, setStatus] = useState('PENDING');
  const [riderLocation, setRiderLocation] = useState(null);
  const [relay] = useState(() =>
    new RelayRealtimeClient({
      getToken: async (taskIds) => {
        const res = await fetch('/api/relay/token', {
          method: 'POST',
          body: JSON.stringify({ taskIds }),
        });
        return (await res.json()).token;
      },
    })
  );

  useEffect(() => {
    // Listen to task (auto-connects, auto-fetches token)
    relay.listen(taskId);

    // Register event handlers
    relay.on('TASK_ASSIGNED', (event) => {
      if (event.taskId === taskId) setStatus('ASSIGNED');
    });

    relay.on('TASK_IN_PROGRESS', (event) => {
      if (event.taskId === taskId) setStatus('IN_PROGRESS');
    });

    relay.on('TASK_COMPLETED', (event) => {
      if (event.taskId === taskId) setStatus('COMPLETED');
    });

    relay.on('RIDER_LOCATION_UPDATE', (event) => {
      if (event.taskId === taskId) setRiderLocation(event.location);
    });

    // Cleanup
    return () => {
      relay.stopListening(taskId);
    };
  }, [taskId]);

  return (
    <div>
      <h2>Task Status: {status}</h2>
      {riderLocation && (
        <div>
          Rider Location: {riderLocation.latitude}, {riderLocation.longitude}
        </div>
      )}
    </div>
  );
}
```

### Vue 3 Example

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { RelayRealtimeClient } from '@relay-sdk/sdk-browser';

const props = defineProps<{ taskId: string }>();
const status = ref('PENDING');
const riderLocation = ref(null);

const relay = new RelayRealtimeClient({
  getToken: async (taskIds) => {
    const res = await fetch('/api/relay/token', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });
    return (await res.json()).token;
  },
});

onMounted(async () => {
  // Listen to task
  await relay.listen(props.taskId);

  // Register event handlers
  relay.on('TASK_ASSIGNED', (event) => {
    if (event.taskId === props.taskId) status.value = 'ASSIGNED';
  });

  relay.on('RIDER_LOCATION_UPDATE', (event) => {
    if (event.taskId === props.taskId) riderLocation.value = event.location;
  });

  relay.on('TASK_COMPLETED', (event) => {
    if (event.taskId === props.taskId) status.value = 'COMPLETED';
  });
});

onUnmounted(() => {
  relay.stopListening(props.taskId);
});
</script>

<template>
  <div>
    <h2>Task Status: {{ status }}</h2>
    <div v-if="riderLocation">
      Rider: {{ riderLocation.latitude }}, {{ riderLocation.longitude }}
    </div>
  </div>
</template>
```

### Multiple Tasks Example

```typescript
const relay = new RelayRealtimeClient({
  getToken: async (taskIds) => {
    // SDK requests token for all tasks at once
    console.log('Requesting token for:', taskIds);
    const res = await fetch('/api/relay/token', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });
    return (await res.json()).token;
  },
});

// Listen to multiple tasks
await Promise.all([
  relay.listen('task-1'),
  relay.listen('task-2'),
  relay.listen('task-3'),
]);

// SDK fetches a single token scoped to all 3 tasks

// Get currently listening tasks
console.log(relay.getListeningTo()); // ['task-1', 'task-2', 'task-3']

// Stop listening to a task
await relay.stopListening('task-2');
```

## API Reference

### Constructor Options

```typescript
new RelayRealtimeClient(options: RelayRealtimeClientOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `getToken` | `(taskIds: string[]) => Promise<string> \| string` | **Required** | Callback to fetch authentication token from your backend |
| `url` | `string` | `wss://ws.sendrelay.com.ng/v1` | WebSocket server URL |
| `deviceId` | `string` | `undefined` | Optional unique device identifier |
| `autoRefresh` | `boolean` | `true` | Auto-refresh tokens before expiration |
| `tokenExpirationWarningMs` | `number` | `300000` | Token expiration warning threshold (5 min) |
| `reconnect.enabled` | `boolean` | `true` | Enable automatic reconnection |
| `reconnect.maxAttempts` | `number` | `Infinity` | Max reconnection attempts |
| `reconnect.initialDelayMs` | `number` | `1000` | Initial reconnection delay (1s) |
| `reconnect.maxDelayMs` | `number` | `30000` | Max reconnection delay (30s) |
| `reconnect.backoffMultiplier` | `number` | `1.5` | Backoff multiplier |
| `heartbeat.enabled` | `boolean` | `true` | Enable heartbeat monitoring |
| `heartbeat.intervalMs` | `number` | `30000` | Ping interval (30s) |
| `heartbeat.timeoutMs` | `number` | `10000` | Pong timeout (10s) |
| `logger` | `object` | `undefined` | Optional logger for debugging |

### Methods

#### `listen(taskId: string): Promise<void>`

Start listening to task events. This is the primary method for tracking tasks.

```typescript
await relay.listen('task-123');
```

Automatically:
1. Fetches authentication token (if needed)
2. Connects to WebSocket (if not connected)
3. Subscribes to task updates

#### `stopListening(taskId: string): Promise<void>`

Stop listening to task events.

```typescript
await relay.stopListening('task-123');
```

#### `getListeningTo(): string[]`

Get all task IDs being listened to.

```typescript
const taskIds = relay.getListeningTo();
console.log(`Listening to ${taskIds.length} tasks`);
```

#### `connect(): Promise<void>`

Manually connect to WebSocket server (usually not needed - connection is automatic).

```typescript
await relay.connect();
```

#### `disconnect(graceful?: boolean): void`

Disconnect from WebSocket server.

```typescript
relay.disconnect(); // Graceful disconnect (waits for pending messages)
relay.disconnect(false); // Immediate disconnect
```

#### `on<T>(event: EventType, handler: EventHandler<T>): () => void`

Subscribe to an event. Returns cleanup function.

```typescript
const unsubscribe = relay.on('TASK_ASSIGNED', (event) => {
  console.log(event);
});

// Later: remove listener
unsubscribe();
```

#### `once<T>(event: EventType, handler: EventHandler<T>): void`

Subscribe to an event once (auto-removed after first invocation).

```typescript
relay.once('TASK_COMPLETED', (event) => {
  console.log('Task completed once:', event);
});
```

#### `off<T>(event: EventType, handler: EventHandler<T>): void`

Remove an event listener.

```typescript
const handler = (event) => console.log(event);
relay.on('TASK_ASSIGNED', handler);
relay.off('TASK_ASSIGNED', handler);
```

#### `getState(): ConnectionState`

Get current connection state.

```typescript
const state = relay.getState();
// Returns: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'reconnecting'
```

#### `isConnected(): boolean`

Check if connected.

```typescript
if (relay.isConnected()) {
  console.log('Connected!');
}
```

## Event Types

### Task Lifecycle Events (8 events)

#### `TASK_CREATED`
Fired when task is created.

```typescript
relay.on('TASK_CREATED', (event) => {
  event.taskId;        // string
  event.developerId;   // string
  event.taskType;      // 'PACKAGE_DELIVERY' | ...
  event.priority;      // 'STANDARD' | 'URGENT'
  event.deliveryFee;   // number (kobo)
  event.totalFee;      // number (kobo)
  event.createdAt;     // string (ISO 8601)
});
```

#### `TASK_OFFERED`
Fired when task is offered to riders.

```typescript
relay.on('TASK_OFFERED', (event) => {
  event.taskId;        // string
  event.developerId;   // string
  event.status;        // 'OFFERED'
  event.tier;          // number (offering tier)
  event.ridersOffered; // number
  event.offeredAt;     // string
});
```

#### `TASK_ASSIGNED`
Fired when task is assigned to a rider.

```typescript
relay.on('TASK_ASSIGNED', (event) => {
  event.taskId;        // string
  event.riderId;       // string
  event.developerId;   // string
  event.status;        // 'ASSIGNED'
  event.assignedAt;    // string
  event.deliveryFee;   // number (kobo)
  event.currentStageIndex; // number
});
```

#### `TASK_IN_PROGRESS`
Fired when rider starts task.

```typescript
relay.on('TASK_IN_PROGRESS', (event) => {
  event.taskId;              // string
  event.riderId;             // string
  event.status;              // 'IN_PROGRESS'
  event.currentStageIndex;   // number
  event.startedAt;           // string
});
```

#### `TASK_COMPLETED`
Fired when task is completed.

```typescript
relay.on('TASK_COMPLETED', (event) => {
  event.taskId;        // string
  event.riderId;       // string
  event.developerId;   // string
  event.status;        // 'COMPLETED'
  event.completedAt;   // string
  event.deliveryFee;   // number (kobo)
  event.paymentStatus; // 'PENDING' | 'RELEASED' | undefined
});
```

#### `TASK_FAILED`
Fired when task fails.

```typescript
relay.on('TASK_FAILED', (event) => {
  event.taskId;        // string
  event.status;        // 'FAILED'
  event.reason;        // string
  event.failedAt;      // string
});
```

#### `TASK_CANCELLED`
Fired when task is cancelled.

```typescript
relay.on('TASK_CANCELLED', (event) => {
  event.taskId;        // string
  event.developerId;   // string
  event.riderId;       // string | undefined
  event.status;        // 'CANCELLED'
  event.reason;        // string
  event.cancelledAt;   // string
});
```

#### `STAGE_COMPLETED`
Fired when a task stage is completed (pickup/dropoff).

```typescript
relay.on('STAGE_COMPLETED', (event) => {
  event.taskId;        // string
  event.riderId;       // string
  event.developerId;   // string
  event.stageIndex;    // number
  event.stage.type;    // 'PICKUP' | 'DROPOFF'
  event.stage.completedAt; // string
  event.stage.completionPhoto; // string | undefined
  event.stage.completionNotes; // string | undefined
  event.nextStageIndex; // number | undefined
  event.totalStages;    // number
});
```

### Payment Events (4 events)

#### `PAYMENT_PENDING`
Payment held in escrow.

```typescript
relay.on('PAYMENT_PENDING', (event) => {
  event.transactionId;       // string
  event.taskId;              // string
  event.amount;              // number (kobo)
  event.status;              // 'PENDING'
  event.releaseAt;           // string
  event.disputeWindowHours;  // number
});
```

#### `PAYMENT_RELEASED`
Payment released to rider.

```typescript
relay.on('PAYMENT_RELEASED', (event) => {
  event.transactionId;  // string
  event.taskId;         // string
  event.riderId;        // string
  event.amount;         // number (kobo)
  event.status;         // 'RELEASED'
  event.releasedAt;     // string
});
```

#### `PAYMENT_DISPUTED`
Payment disputed by developer.

```typescript
relay.on('PAYMENT_DISPUTED', (event) => {
  event.transactionId;  // string
  event.taskId;         // string
  event.riderId;        // string
  event.amount;         // number (kobo)
  event.reason;         // string
  event.disputedAt;     // string
});
```

#### `PAYMENT_DISPUTE_RESOLVED`
Dispute resolved by admin.

```typescript
relay.on('PAYMENT_DISPUTE_RESOLVED', (event) => {
  event.transactionId;  // string
  event.taskId;         // string
  event.resolution;     // 'DEVELOPER' | 'RIDER' | 'SPLIT'
  event.resolvedBy;     // string (admin ID)
  event.resolvedAt;     // string
});
```

### Real-Time Events (2 events)

#### `RIDER_LOCATION_UPDATE`
Real-time rider GPS location updates.

```typescript
relay.on('RIDER_LOCATION_UPDATE', (event) => {
  event.riderId;    // string
  event.taskId;     // string
  event.location.latitude;   // number
  event.location.longitude;  // number
  event.location.bearing;    // number | null | undefined
  event.location.speed;      // number | null | undefined
  event.location.accuracy;   // number | null | undefined
  event.timestamp;  // string
});
```

#### `NEW_TASK_OFFER`
New task offered to rider (rider-only event).

```typescript
relay.on('NEW_TASK_OFFER', (event) => {
  event.taskId;        // string
  event.tier;          // number
  event.task.deliveryFee; // number (kobo)
  event.task.pickupLocation; // Location
  event.task.dropoffCount; // number
  event.offerExpiresAt; // string
  event.offerTimeoutSeconds; // number
});
```

### Connection Events (5 events)

#### `CONNECTION_OPEN`
Connection established.

```typescript
relay.on('CONNECTION_OPEN', (event) => {
  event.state;  // 'connected'
});
```

#### `CONNECTION_CLOSE`
Connection closed.

```typescript
relay.on('CONNECTION_CLOSE', (event) => {
  event.state;   // 'disconnected'
  event.code;    // number
  event.reason;  // string
});
```

#### `CONNECTION_ERROR`
Connection error occurred.

```typescript
relay.on('CONNECTION_ERROR', (event) => {
  event.error;  // Error
});
```

#### `CONNECTION_RECONNECTING`
Reconnection attempt in progress.

```typescript
relay.on('CONNECTION_RECONNECTING', (event) => {
  event.attempt;  // number
  event.delay;    // number (ms)
});
```

#### `TOKEN_EXPIRING`
Token expiring soon (default: 5 minutes before expiration).

**Note**: Token refresh is automatic if `autoRefresh: true` (default). This event is for UI feedback only.

```typescript
relay.on('TOKEN_EXPIRING', async (event) => {
  event.expiresAt;  // string (ISO timestamp)
  event.expiresIn;  // number (milliseconds until expiration)
  event.warningMs;  // number | undefined (legacy alias)

  // Show UI warning (token refresh is automatic)
  showToast('Refreshing session...');
});
```

## Error Handling

```typescript
import { RelayError, ConnectionError, TokenError } from '@relay-sdk/sdk-browser';

try {
  await relay.listen('task-123');
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Connection failed:', error.message);
  } else if (error instanceof TokenError) {
    console.error('Invalid token:', error.message);
  } else if (error instanceof RelayError) {
    console.error('Relay error:', error.message);
  }
}

// Listen for connection errors
relay.on('CONNECTION_ERROR', (event) => {
  console.error('Connection error:', event.error);
});
```

## Advanced Usage

### Custom Logger

```typescript
const relay = new RelayRealtimeClient({
  getToken: fetchTokenFromBackend,
  logger: {
    debug: (msg, meta) => console.debug(msg, meta),
    info: (msg, meta) => console.info(msg, meta),
    warn: (msg, meta) => console.warn(msg, meta),
    error: (msg, meta) => console.error(msg, meta),
  },
});
```

### Disable Reconnection

```typescript
const relay = new RelayRealtimeClient({
  getToken: fetchTokenFromBackend,
  reconnect: {
    enabled: false,
  },
});
```

### Disable Automatic Token Refresh

```typescript
const relay = new RelayRealtimeClient({
  getToken: fetchTokenFromBackend,
  autoRefresh: false, // Manual token refresh
});

relay.on('TOKEN_EXPIRING', async () => {
  // Handle token refresh manually
  // (Connection will be lost if token expires)
});
```

## Troubleshooting

### Connection Failed

```typescript
relay.on('CONNECTION_ERROR', (event) => {
  console.error('Error:', event.error);

  // Common issues:
  // 1. Invalid token
  // 2. Token expired
  // 3. Network connectivity
  // 4. WebSocket blocked by firewall
  // 5. Backend getToken() callback failing
});
```

### Token Provisioning Failed

```typescript
// Check your getToken callback
const relay = new RelayRealtimeClient({
  getToken: async (taskIds) => {
    try {
      const res = await fetch('/api/relay/token', {
        method: 'POST',
        body: JSON.stringify({ taskIds }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const { token } = await res.json();
      return token;
    } catch (error) {
      console.error('Token fetch failed:', error);
      throw error;
    }
  },
});
```

### Not Receiving Events

1. **Check listening**: Ensure you're listening to the task
```typescript
await relay.listen(taskId);
```

2. **Check token scope**: Token must have access to the task
```typescript
// Backend: Ensure task ID is in scope
const { token } = await relay.auth.createWebSocketToken({
  scope: taskIds.map(id => `task:${id}`), // Include all task IDs
});
```

3. **Check connection state**: Verify connection is established
```typescript
if (!relay.isConnected()) {
  console.log('Not connected. Check CONNECTION_ERROR events.');
}
```

## Migration from v1.x

**Quick summary:**
- Replace `token` option → `getToken` callback
- Replace `subscribe('task', id)` → `listen(id)`
- Replace `unsubscribe('task', id)` → `stopListening(id)`
- Remove `updateToken()` calls → Automatic refresh now
- Remove `autoConnect` option → Lazy connection now

## TypeScript Support

Full TypeScript support with type-safe event handlers:

```typescript
import { RelayRealtimeClient, EventType, TaskAssignedEvent } from '@relay-sdk/sdk-browser';

const relay = new RelayRealtimeClient({ getToken: fetchToken });

// Type-safe event handler
relay.on('TASK_ASSIGNED', (event: TaskAssignedEvent) => {
  event.taskId;    // ✅ Type: string
  event.riderId;   // ✅ Type: string
  event.currentStageIndex; // ✅ Type: number
  event.invalid;   // ❌ TypeScript error: Property 'invalid' does not exist
});
```

## License

MIT

## Support

- Documentation: https://docs.sendrelay.com.ng
- GitHub Issues: https://github.com/SendRelay/relay-sdk-browser/issues
- Email: ops@sendrelay.com.ng
