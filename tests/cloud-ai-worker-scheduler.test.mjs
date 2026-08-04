import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  readCloudAiSchedulerConfig,
  runCloudAiWorkerScheduler,
} from "../scripts/run-cloud-ai-worker-scheduler.mjs";

const enabledEnv = {
  MANGAI_CLOUD_AI_SCHEDULER_ENABLED: "true",
  MANGAI_CLOUD_AI_WORKER_URL: "https://app.example.com/api/internal/cloud-ai/worker",
  MANGAI_CLOUD_AI_WORKER_SECRET: "x".repeat(32),
};

function jsonResponse(status, httpStatus = 200, extra = {}) {
  return {
    ok: httpStatus >= 200 && httpStatus < 300,
    status: httpStatus,
    json: async () => ({ status, ...extra }),
  };
}

test("disabled scheduler never calls the worker", async () => {
  let called = false;
  const result = await runCloudAiWorkerScheduler({
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
    processed: 0,
    finalStatus: "disabled",
  });
});

test("enabled scheduler validates credentials and HTTPS before network access", () => {
  assert.throws(
    () => readCloudAiSchedulerConfig({ ...enabledEnv, MANGAI_CLOUD_AI_WORKER_SECRET: "short" }),
    /認証設定/,
  );
  assert.throws(
    () => readCloudAiSchedulerConfig({ ...enabledEnv, MANGAI_CLOUD_AI_WORKER_URL: "http://example.com/worker" }),
    /HTTPS/,
  );
});

test("idle stops after one request", async () => {
  let calls = 0;
  const result = await runCloudAiWorkerScheduler({
    env: enabledEnv,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse("idle");
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.processed, 0);
  assert.equal(result.finalStatus, "idle");
});

test("completed jobs continue only to the configured upper bound", async () => {
  let calls = 0;
  const result = await runCloudAiWorkerScheduler({
    env: { ...enabledEnv, MANGAI_CLOUD_AI_SCHEDULER_MAX_JOBS: "9" },
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse("completed", 200, { jobId: "private-id" });
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.processed, 3);
  assert.equal(result.finalStatus, "completed");
  assert.equal("jobId" in result, false);
});

test("retrying and lease_lost stop without a tight retry loop", async () => {
  for (const status of ["retrying", "lease_lost"]) {
    let calls = 0;
    const result = await runCloudAiWorkerScheduler({
      env: enabledEnv,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(status);
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.finalStatus, status);
  }
});

test("HTTP and malformed-response errors do not expose provider or secret content", async () => {
  await assert.rejects(
    runCloudAiWorkerScheduler({
      env: enabledEnv,
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: "provider-private-error", secret: enabledEnv.MANGAI_CLOUD_AI_WORKER_SECRET }),
      }),
    }),
    (error) =>
      !error.message.includes("provider-private-error") &&
      !error.message.includes(enabledEnv.MANGAI_CLOUD_AI_WORKER_SECRET),
  );
});

test("workflow is bounded, serialized, and disabled by default", async () => {
  const workflow = await readFile(".github/workflows/cloud-ai-worker-scheduler.yml", "utf8");
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(workflow, /MANGAI_CLOUD_AI_SCHEDULER_ENABLED == 'true'/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /MANGAI_CLOUD_AI_WORKER_SECRET: \$\{\{ secrets\./);
  assert.doesNotMatch(workflow, /Bearer\s+[A-Za-z0-9_-]{20}/);
});

test("manual dispatch checks settings by default and requires an explicit run choice", async () => {
  const workflow = await readFile(".github/workflows/cloud-ai-worker-scheduler.yml", "utf8");
  assert.match(workflow, /default: check/);
  assert.match(workflow, /inputs\.mode == 'check'/);
  assert.match(workflow, /run-cloud-ai-worker-scheduler\.mjs --check/);
  assert.match(workflow, /inputs\.mode == 'run'/);
  assert.match(
    workflow,
    /MANGAI_CLOUD_AI_SCHEDULER_ENABLED == 'true'.*inputs\.mode == 'run'/,
  );
});
