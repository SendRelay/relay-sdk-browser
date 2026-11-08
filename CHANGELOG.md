# Changelog

## 1.9.0 — 2026-11-08

- New realtime events: `STAGE_ARRIVED` (the rider reached a stop), `TASK_DETAILS_UPDATED` (notes, instructions or a stop contact changed) and, for tasks created with `dispatch.onRiderCancel: 'FIND_ANOTHER'`, `TASK_RIDER_UNASSIGNED`.
- `createTaskTracker` moves a task back to `PENDING` and clears the rider and ETA on `TASK_RIDER_UNASSIGNED`, and records the other two in `events`.

## 1.8.0 — 2026-11-03

- Keep looking for a rider and scheduled pickups ([dispatch strategies](https://docs.sendrelay.com.ng/tasks/keep-looking-and-scheduling)).
- `TASK_DISPATCH_STARTED`, `TASK_SEARCHING` and `TASK_RIDERS_NEARBY` events. The tracker reports `SCHEDULED` and `SEARCHING` and keeps `searchExpiresAt` to count down to (seed it with `initial.searchExpiresAt`).
- A task status this version doesn't know is kept as its raw string (`TrackedTaskStatus` now says so) and counts as not finished. Relay will add statuses for tasks that keep searching for a rider.

## 1.7.0 — 2026-10-29

- `createTaskTracker`: one store with a task's status, rider position, live ETA and connection state. The React, Vue, Svelte and React Native packages are built on it.
- Generates a `deviceId` when you don't pass one.
- Runs the shared SDK conformance suite.
- From this release the Relay app SDKs share one version.
