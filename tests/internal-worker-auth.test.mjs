import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hasValidInternalWorkerAuthorization } from "../src/lib/internal-worker-auth.ts";

const routeContracts = [
  [
    "../src/app/api/internal/cloud-ai/worker/route.ts",
    "MANGAI_CLOUD_AI_WORKER_SECRET",
  ],
  [
    "../src/app/api/internal/cloud-export/worker/route.ts",
    "MANGAI_CLOUD_EXPORT_WORKER_SECRET",
  ],
  [
    "../src/app/api/internal/cloud-storage/worker/route.ts",
    "MANGAI_CLOUD_STORAGE_WORKER_SECRET",
  ],
  [
    "../src/app/api/internal/monitor-ops/worker/route.ts",
    "MANGAI_MONITOR_OPS_WORKER_SECRET",
  ],
];

const request = (authorization) =>
  new Request("https://app.example.com/api/internal/worker", {
    headers: authorization ? { authorization } : undefined,
  });

test("internal Worker認証は既存Bearer・長さ・定数時間比較契約を維持する", () => {
  const secret = "s".repeat(32);

  assert.equal(hasValidInternalWorkerAuthorization(request(), secret), false);
  assert.equal(
    hasValidInternalWorkerAuthorization(request(`Bearer ${secret}`), undefined),
    false,
  );
  assert.equal(
    hasValidInternalWorkerAuthorization(request(`Bearer ${secret}`), "short"),
    false,
  );
  assert.equal(
    hasValidInternalWorkerAuthorization(request(`Basic ${secret}`), secret),
    false,
  );
  assert.equal(
    hasValidInternalWorkerAuthorization(request(`bearer ${secret}`), secret),
    true,
  );
  assert.equal(
    hasValidInternalWorkerAuthorization(request(`Bearer ${"x".repeat(32)}`), secret),
    false,
  );
  assert.equal(
    hasValidInternalWorkerAuthorization(request(`Bearer ${secret}x`), secret),
    false,
  );
});

test("4つのWorker Routeはenv名と401契約を保持して共通比較を使う", async () => {
  for (const [path, environmentName] of routeContracts) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /@\/lib\/internal-worker-auth/, path);
    assert.match(source, /hasValidInternalWorkerAuthorization/, path);
    assert.ok(source.includes(environmentName), `${path}: ${environmentName}`);
    assert.match(source, /認証できません。/, path);
    assert.match(source, /status:\s*401|AuthenticationRequiredError/, path);
    assert.doesNotMatch(source, /timingSafeEqual|node:crypto/, path);
  }
});
