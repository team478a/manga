import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  readCloudExportSchedulerConfig,
  runCloudExportWorkerScheduler,
} from "../scripts/run-cloud-export-worker-scheduler.mjs";

const enabledEnv = {
  MANGAI_CLOUD_EXPORT_SCHEDULER_ENABLED: "true",
  MANGAI_CLOUD_EXPORT_WORKER_URL:
    "https://app.example.com/api/internal/cloud-export/worker",
  MANGAI_CLOUD_EXPORT_WORKER_SECRET: "x".repeat(32),
};

function jsonResponse(status, httpStatus = 200, extra = {}) {
  return {
    ok: httpStatus >= 200 && httpStatus < 300,
    status: httpStatus,
    json: async () => ({ status, ...extra }),
  };
}

test("disabled export scheduler never calls the worker", async () => {
  let called = false;
  const result = await runCloudExportWorkerScheduler({
    env: {},
    fetchImpl: async () => {
      called = true;
    },
    logger: { log() {} },
  });
  assert.equal(called, false);
  assert.deepEqual(result, {
    enabled: false,
    requests: 0,
    processedSegments: 0,
    finalStatus: "disabled",
  });
});

test("enabled export scheduler validates credentials, HTTPS, and the worker path", () => {
  assert.throws(
    () =>
      readCloudExportSchedulerConfig({
        ...enabledEnv,
        MANGAI_CLOUD_EXPORT_WORKER_SECRET: "short",
      }),
    /認証設定/,
  );
  assert.throws(
    () =>
      readCloudExportSchedulerConfig({
        ...enabledEnv,
        MANGAI_CLOUD_EXPORT_WORKER_URL: "http://example.com/worker",
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      readCloudExportSchedulerConfig({
        ...enabledEnv,
        MANGAI_CLOUD_EXPORT_WORKER_URL:
          "https://app.example.com/api/internal/cloud-ai/worker",
      }),
    /URL設定/,
  );
});

test("idle stops after one request", async () => {
  let calls = 0;
  const result = await runCloudExportWorkerScheduler({
    env: enabledEnv,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse("idle");
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.processedSegments, 0);
  assert.equal(result.finalStatus, "idle");
});

test("segment completion continues only to the configured upper bound", async () => {
  let calls = 0;
  const result = await runCloudExportWorkerScheduler({
    env: {
      ...enabledEnv,
      MANGAI_CLOUD_EXPORT_SCHEDULER_MAX_SEGMENTS: "9",
    },
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse("segment_completed", 200, { jobId: "private-id" });
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.processedSegments, 3);
  assert.equal(result.finalStatus, "segment_completed");
  assert.equal("jobId" in result, false);
});

test("completed output can continue to the next queued job", async () => {
  const statuses = ["completed", "segment_completed", "idle"];
  let calls = 0;
  const result = await runCloudExportWorkerScheduler({
    env: enabledEnv,
    fetchImpl: async () => jsonResponse(statuses[calls++]),
  });
  assert.equal(calls, 3);
  assert.equal(result.processedSegments, 2);
  assert.equal(result.finalStatus, "idle");
});

test("failed segment stops without a tight automatic retry loop", async () => {
  let calls = 0;
  const result = await runCloudExportWorkerScheduler({
    env: enabledEnv,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse("failed", 200, { error: "private-error" });
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.processedSegments, 0);
  assert.equal(result.finalStatus, "failed");
});

test("HTTP and malformed responses never expose response or secret content", async () => {
  await assert.rejects(
    runCloudExportWorkerScheduler({
      env: enabledEnv,
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        json: async () => ({
          error: "storage-private-error",
          secret: enabledEnv.MANGAI_CLOUD_EXPORT_WORKER_SECRET,
        }),
      }),
    }),
    (error) =>
      !error.message.includes("storage-private-error") &&
      !error.message.includes(enabledEnv.MANGAI_CLOUD_EXPORT_WORKER_SECRET),
  );
});

test("workflow is bounded, serialized, disabled by default, and manually explicit", async () => {
  const workflow = await readFile(
    ".github/workflows/cloud-export-worker-scheduler.yml",
    "utf8",
  );
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(
    workflow,
    /vars\.MANGAI_CLOUD_EXPORT_SCHEDULER_ENABLED == 'true'/,
  );
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /timeout-minutes: 20/);
  assert.match(
    workflow,
    /MANGAI_CLOUD_EXPORT_SCHEDULER_MAX_SEGMENTS: "3"/,
  );
  assert.match(
    workflow,
    /MANGAI_CLOUD_EXPORT_SCHEDULER_TIMEOUT_SECONDS: "285"/,
  );
  assert.match(
    workflow,
    /MANGAI_CLOUD_EXPORT_WORKER_SECRET: \$\{\{ secrets\./,
  );
  assert.match(workflow, /default: check/);
  assert.match(workflow, /inputs\.mode == 'check'/);
  assert.match(workflow, /run-cloud-export-worker-scheduler\.mjs --check/);
  assert.match(workflow, /inputs\.mode == 'run'/);
  assert.doesNotMatch(workflow, /Bearer\s+[A-Za-z0-9_-]{20}/);
});
