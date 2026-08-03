import assert from "node:assert/strict";
import test from "node:test";
import { getCloudAiWorkerHealth } from "../src/lib/cloud-ai-worker-health.ts";

const now = new Date("2026-08-04T00:00:00.000Z");
const base = {
  workerReady: true,
  queued: 0,
  running: 0,
  failedLast24Hours: 0,
  staleLeases: 0,
  now,
};

test("worker settings fail closed", () => {
  assert.equal(getCloudAiWorkerHealth({ ...base, workerReady: false }).status, "stopped");
});

test("stale leases and repeated failures require action", () => {
  assert.equal(getCloudAiWorkerHealth({ ...base, staleLeases: 1 }).status, "critical");
  assert.equal(getCloudAiWorkerHealth({ ...base, failedLast24Hours: 3 }).status, "critical");
});

test("old queue detects scheduler delay", () => {
  const result = getCloudAiWorkerHealth({
    ...base,
    queued: 1,
    oldestQueuedAt: "2026-08-03T23:45:00.000Z",
  });
  assert.equal(result.status, "warning");
  assert.equal(result.oldestQueueMinutes, 15);
});

test("active and idle queues stay visible without false alarms", () => {
  assert.equal(getCloudAiWorkerHealth({ ...base, running: 1 }).status, "active");
  assert.equal(getCloudAiWorkerHealth(base).status, "idle");
});
