import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) =>
  readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("Creator Queue APIはCloud AI presentationへの薄いadapterである", async () => {
  for (const relative of [
    "src/app/api/creator/generation-jobs/route.ts",
    "src/app/api/creator/generation-jobs/[jobId]/route.ts",
  ]) {
    const source = await read(relative);
    assert.match(source, /modules\/cloud-ai\/presentation\/generation-route/);
    assert.doesNotMatch(source, /createAdminClient|\.from\(|\.rpc\(|fetch\(/);
  }
});

test("Queue presentationは入力・rate limit・安全なError変換を維持する", async () => {
  const source = await read(
    "src/modules/cloud-ai/presentation/generation-route.ts",
  );
  assert.match(source, /generation-request\.ts/);
  assert.match(source, /enforceCloudAiRateLimit/);
  assert.match(source, /idempotencyKey: z\.string\(\)\.uuid\(\)/);
  assert.match(source, /status: 202/);
  assert.match(source, /toApiError/);
  assert.doesNotMatch(
    source,
    /createAdminClient|SUPABASE_SERVICE_ROLE_KEY|service.?role|\.from\(|\.rpc\(/i,
  );
});

test("Queue applicationは既存generation serviceへ契約を変えず委譲する", async () => {
  const enqueue = await read(
    "src/modules/cloud-ai/application/enqueue-generation.ts",
  );
  const cancel = await read(
    "src/modules/cloud-ai/application/cancel-generation.ts",
  );
  assert.match(enqueue, /cloud-creator\/generation\/generation-service\.ts/);
  assert.match(cancel, /cloud-creator\/generation\/generation-service\.ts/);
  assert.match(enqueue, /enqueueCloudGenerationJob/);
  assert.match(enqueue, /listCloudGenerationJobs/);
  assert.match(cancel, /cancelCloudGenerationJob/);
});
