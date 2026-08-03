import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getCloudAiWorkerConfiguration,
  getCloudAiWorkerInvocationUrl,
} from "../src/lib/cloud-ai-worker-admin.ts";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Worker設定は有効状態と32文字以上の秘密鍵を両方要求する", () => {
  assert.deepEqual(getCloudAiWorkerConfiguration({}), {
    enabled: false,
    secretReady: false,
    ready: false,
  });
  assert.equal(
    getCloudAiWorkerConfiguration({
      MANGAI_CLOUD_AI_WORKER_ENABLED: "true",
      MANGAI_CLOUD_AI_WORKER_SECRET: "a".repeat(32),
    }).ready,
    true,
  );
});

test("Worker呼び出し先は現在のVercel deploymentを優先して固定する", () => {
  assert.equal(
    getCloudAiWorkerInvocationUrl({ VERCEL_URL: "preview.example.vercel.app" }),
    "https://preview.example.vercel.app/api/internal/cloud-ai/worker",
  );
  assert.equal(
    getCloudAiWorkerInvocationUrl({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" }),
    null,
  );
});

test("管理画面は秘密鍵を表示せずQueueと手動実行を提供する", async () => {
  const [page, actions] = await Promise.all([
    readSource("../src/app/admin/cloud-ai/page.tsx"),
    readSource("../src/app/admin/cloud-ai/actions.ts"),
  ]);
  assert.match(page, /待機中Jobを1件実行/);
  assert.match(page, /Workerを実行中/);
  assert.match(page, /queuedResult\.count/);
  assert.match(actions, /requireAdmin/);
  assert.match(actions, /authorization: `Bearer \$\{secret\}`/);
  assert.doesNotMatch(page, /MANGAI_CLOUD_AI_WORKER_SECRET/);
});
