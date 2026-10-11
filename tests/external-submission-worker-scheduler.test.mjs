import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  probeExternalSubmissionWorkerScheduler,
  readExternalSubmissionSchedulerConfig,
  runExternalSubmissionWorkerScheduler,
} from "../scripts/run-external-submission-worker-scheduler.mjs";

const enabledEnv = {
  MANGAI_EXTERNAL_SUBMISSION_SCHEDULER_ENABLED: "true",
  MANGAI_EXTERNAL_SUBMISSION_WORKER_URL:
    "https://app.example.com/api/internal/external-submissions/worker",
  MANGAI_EXTERNAL_SUBMISSION_WORKER_SECRET: "x".repeat(32),
};

function jsonResponse(status, httpStatus = 200, extra = {}) {
  return {
    ok: httpStatus >= 200 && httpStatus < 300,
    status: httpStatus,
    json: async () => ({ status, ...extra }),
  };
}

test("disabled external submission scheduler never calls the worker", async () => {
  let called = false;
  const result = await runExternalSubmissionWorkerScheduler({
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

test("enabled scheduler validates credentials, HTTPS, and the exact worker path", () => {
  assert.throws(
    () =>
      readExternalSubmissionSchedulerConfig({
        ...enabledEnv,
        MANGAI_EXTERNAL_SUBMISSION_WORKER_SECRET: "short",
      }),
    /認証設定/,
  );
  assert.throws(
    () =>
      readExternalSubmissionSchedulerConfig({
        ...enabledEnv,
        MANGAI_EXTERNAL_SUBMISSION_WORKER_URL: "http://example.com/worker",
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      readExternalSubmissionSchedulerConfig({
        ...enabledEnv,
        MANGAI_EXTERNAL_SUBMISSION_WORKER_URL:
          "https://app.example.com/api/internal/external-submissions/worker?unsafe=true",
      }),
    /URL設定/,
  );
});

test("one run sends exactly one request and omits private response fields", async () => {
  let calls = 0;
  const result = await runExternalSubmissionWorkerScheduler({
    env: enabledEnv,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse("completed", 200, {
        submissionId: "private-submission-id",
      });
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, {
    enabled: true,
    requests: 1,
    processed: 1,
    finalStatus: "completed",
  });
  assert.equal("submissionId" in result, false);
});

test("probe sends one GET request and accepts only the ready status", async () => {
  const methods = [];
  const result = await probeExternalSubmissionWorkerScheduler({
    env: enabledEnv,
    fetchImpl: async (_url, init) => {
      methods.push(init.method);
      return jsonResponse("ready");
    },
  });
  assert.deepEqual(methods, ["GET"]);
  assert.deepEqual(result, { enabled: true, requests: 1, status: "ready" });
  await assert.rejects(
    probeExternalSubmissionWorkerScheduler({
      env: enabledEnv,
      fetchImpl: async () => jsonResponse("unavailable"),
    }),
    /準備未完了/,
  );
});

test("idle and failed responses stop after the single bounded request", async () => {
  for (const status of ["idle", "failed"]) {
    let calls = 0;
    const result = await runExternalSubmissionWorkerScheduler({
      env: enabledEnv,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(status, 200, { errorCode: "private-error" });
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.processed, status === "idle" ? 0 : 1);
    assert.equal(result.finalStatus, status);
  }
});

test("HTTP and malformed responses never expose response or secret content", async () => {
  await assert.rejects(
    runExternalSubmissionWorkerScheduler({
      env: enabledEnv,
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        json: async () => ({
          error: "storage-private-error",
          secret: enabledEnv.MANGAI_EXTERNAL_SUBMISSION_WORKER_SECRET,
        }),
      }),
    }),
    (error) =>
      !error.message.includes("storage-private-error") &&
      !error.message.includes(enabledEnv.MANGAI_EXTERNAL_SUBMISSION_WORKER_SECRET),
  );
  await assert.rejects(
    runExternalSubmissionWorkerScheduler({
      env: enabledEnv,
      fetchImpl: async () => jsonResponse("unexpected"),
    }),
    /応答の状態/,
  );
});

test("workflow is serialized, disabled by default, bounded to one job, and manually explicit", async () => {
  const workflow = await readFile(
    ".github/workflows/external-submission-worker-scheduler.yml",
    "utf8",
  );
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(
    workflow,
    /vars\.MANGAI_EXTERNAL_SUBMISSION_SCHEDULER_ENABLED == 'true'/,
  );
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /Process at most one external submission ingest job/);
  assert.match(workflow, /MANGAI_EXTERNAL_SUBMISSION_SCHEDULER_TIMEOUT_SECONDS: "285"/);
  assert.match(
    workflow,
    /MANGAI_EXTERNAL_SUBMISSION_WORKER_SECRET: \$\{\{ secrets\./,
  );
  assert.match(workflow, /default: check/);
  assert.match(workflow, /inputs\.mode == 'check'/);
  assert.match(
    workflow,
    /run-external-submission-worker-scheduler\.mjs --check/,
  );
  assert.match(workflow, /inputs\.mode == 'probe'/);
  assert.match(
    workflow,
    /run-external-submission-worker-scheduler\.mjs --probe/,
  );
  assert.match(workflow, /Probe ClamAV readiness without claiming a job/);
  assert.match(workflow, /inputs\.mode == 'run'/);
  assert.doesNotMatch(workflow, /Bearer\s+[A-Za-z0-9_-]{20}/);
});
