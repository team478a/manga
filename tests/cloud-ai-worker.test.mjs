import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  MockCloudImageProvider,
  MockCloudTextProvider,
} from "../src/lib/cloud-ai-mock-provider.ts";
import {
  processNextCloudGenerationJob,
  processPendingCloudStorageCleanup,
} from "../src/lib/cloud-ai-worker.ts";
import {
  removeWhiteBackgroundFromMangaLayer,
  sanitizeCloudGeneratedImage,
} from "../src/lib/cloud-creator-contract.ts";

const context = {
  jobId: "10000000-0000-4000-8000-000000000001",
  projectId: "20000000-0000-4000-8000-000000000001",
  idempotencyKey: "30000000-0000-4000-8000-000000000001",
};

test("mock Cloud image Provider generates a verifiable stripped PNG", async () => {
  const result = await new MockCloudImageProvider().generate(
    {
      kind: "image",
      jobType: "background",
      prompt: "green forest",
      negativePrompt: "",
      width: 512,
      height: 384,
    },
    context,
  );
  assert.equal(result.images.length, 1);
  const sanitized = await sanitizeCloudGeneratedImage(result.images[0].bytes);
  const metadata = await sharp(sanitized.bytes).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 384);
  assert.match(sanitized.sha256, /^[0-9a-f]{64}$/);
});

test("白背景の漫画素材を黒線の透明PNGへ安全に変換する", async () => {
  const source = await sharp({
    create: {
      width: 3,
      height: 1,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      {
        input: Buffer.from([0, 0, 0, 128, 128, 128]),
        raw: { width: 2, height: 1, channels: 3 },
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
  const converted = await removeWhiteBackgroundFromMangaLayer(source);
  const { data, info } = await sharp(converted.bytes)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  assert.deepEqual([data[0], data[1], data[2], data[3]], [0, 0, 0, 255]);
  assert.deepEqual([data[4], data[5], data[6]], [0, 0, 0]);
  assert.ok(data[7] > 100 && data[7] < 140);
  assert.deepEqual([data[8], data[9], data[10], data[11]], [0, 0, 0, 0]);
});

test("mock Cloud text Provider returns usage without a billable cost", async () => {
  const result = await new MockCloudTextProvider().generate(
    {
      kind: "text",
      jobType: "story",
      prompt: "友情の短編",
      negativePrompt: "",
    },
    context,
  );
  assert.match(result.text, /友情の短編/);
  assert.equal(result.usage.actualCostMicros, 0);
  assert.ok(result.usage.inputUnits > 0);
});

function workerClient({
  completionState = "running",
  removeFails = false,
  extendFails = false,
  outputAlphaMode = "preserve",
} = {}) {
  const calls = {
    removed: [],
    cleanup: [],
    completedAssetId: null,
    extended: [],
    finished: [],
    checkpoints: [],
    uploaded: 0,
    uploadedBytes: null,
  };
  const job = {
    id: "10000000-0000-4000-8000-000000000001",
    project_id: "20000000-0000-4000-8000-000000000001",
    page_id: null,
    created_by_profile_id: "30000000-0000-4000-8000-000000000001",
    kind: "image",
    provider_id: "mangai-cloud-mock-image",
    model_id: "mock-image-v1",
    idempotency_key: "worker-compensation-test",
    input: {
      kind: "image",
      jobType: "background",
      prompt: "green forest",
      negativePrompt: "",
      width: 256,
      height: 256,
      outputAlphaMode,
    },
    attempt_count: 1,
    max_attempts: 1,
    provider_job_id: null,
    lease_token: "40000000-0000-4000-8000-000000000001",
  };
  const client = {
    rpc: async (name, args) => {
      if (name === "claim_cloud_generation_job")
        return { data: [job], error: null };
      if (name === "extend_cloud_generation_job_lease") {
        calls.extended.push(args);
        return {
          data: extendFails ? null : new Date(Date.now() + 300_000).toISOString(),
          error: extendFails ? { message: "lease lost" } : null,
        };
      }
      if (name === "complete_cloud_generation_image_job") {
        calls.completedAssetId = args.p_asset_id;
        return { data: null, error: { message: "completion failed" } };
      }
      if (name === "record_cloud_generation_storage_cleanup") {
        calls.cleanup.push(args);
        return { data: "cleanup-id", error: null };
      }
      if (name === "finish_cloud_generation_job") {
        calls.finished.push(args);
        return { data: job.id, error: null };
      }
      throw new Error(`unexpected RPC ${name}`);
    },
    from: (table) => {
      assert.equal(table, "cloud_generation_jobs");
      let updateValue = null;
      return {
        update(value) {
          updateValue = value;
          calls.checkpoints.push(value.provider_job_id);
          return this;
        },
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async single() {
          return {
            data: { status: "running", lease_token: job.lease_token },
            error: null,
          };
        },
        async maybeSingle() {
          if (updateValue) return { data: { id: job.id }, error: null };
          return {
            data: {
              status: completionState,
              output_asset_id:
                completionState === "completed"
                  ? calls.completedAssetId
                  : null,
            },
            error: null,
          };
        },
      };
    },
    storage: {
      from: () => ({
        upload: async (_path, bytes) => {
          calls.uploaded += 1;
          calls.uploadedBytes = new Uint8Array(bytes);
          return { data: null, error: null };
        },
        remove: async (paths) => {
          calls.removed.push(...paths);
          return {
            data: null,
            error: removeFails ? { message: "remove failed" } : null,
          };
        },
      }),
    },
  };
  return { client, calls };
}

test("DB確定失敗時は生成Storageを補償削除する", async () => {
  const { client, calls } = workerClient();
  const result = await processNextCloudGenerationJob({
    workerId: "test-worker",
    providers: [new MockCloudImageProvider()],
    client,
  });
  assert.equal(result.status, "failed");
  assert.equal(calls.removed.length, 1);
  assert.equal(calls.cleanup.length, 0);
});

test("Workerは指定された人物・効果素材だけを透明化して保存する", async () => {
  const { client, calls } = workerClient({ outputAlphaMode: "remove_white" });
  const bytes = await sharp({
    create: {
      width: 2,
      height: 1,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{
      input: Buffer.from([0, 0, 0]),
      raw: { width: 1, height: 1, channels: 3 },
      left: 0,
      top: 0,
    }])
    .png()
    .toBuffer();
  const base = new MockCloudImageProvider();
  const provider = {
    capability: base.capability,
    async generate() {
      return {
        images: [{ bytes: new Uint8Array(bytes), mimeType: "image/png", fileName: "layer.png" }],
        usage: { actualCostMicros: 0 },
      };
    },
  };
  await processNextCloudGenerationJob({
    workerId: "transparent-layer-worker",
    providers: [provider],
    client,
  });
  const raw = await sharp(calls.uploadedBytes).raw().toBuffer();
  assert.equal(raw[3], 255);
  assert.equal(raw[7], 0);
});

test("補償削除失敗時はcleanup対象として記録する", async () => {
  const { client, calls } = workerClient({ removeFails: true });
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await processNextCloudGenerationJob({
      workerId: "test-worker",
      providers: [new MockCloudImageProvider()],
      client,
    });
    assert.equal(result.status, "failed");
  } finally {
    console.error = originalError;
  }
  assert.equal(calls.removed.length, 1);
  assert.equal(calls.cleanup.length, 1);
  assert.equal(calls.cleanup[0].p_bucket_id, "cloud-assets");
});

test("DB応答喪失でも確定済みAssetを補償削除しない", async () => {
  const { client, calls } = workerClient({ completionState: "completed" });
  const result = await processNextCloudGenerationJob({
    workerId: "test-worker",
    providers: [new MockCloudImageProvider()],
    client,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.outputAssetId, calls.completedAssetId);
  assert.equal(calls.removed.length, 0);
});

test("生成中にlease heartbeatしProviderへ同じidempotency keyを渡す", async () => {
  const { client, calls } = workerClient();
  const base = new MockCloudImageProvider();
  let receivedContext;
  const provider = {
    capability: base.capability,
    async generate(input, context, signal) {
      receivedContext = context;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 35);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("aborted", "AbortError"));
          },
          { once: true },
        );
      });
      return base.generate(input, context, signal);
    },
  };
  const result = await processNextCloudGenerationJob({
    workerId: "heartbeat-worker",
    providers: [provider],
    client,
    heartbeatIntervalMs: 10,
  });
  assert.equal(result.status, "failed");
  assert.equal(
    receivedContext.idempotencyKey,
    "worker-compensation-test",
  );
  assert.ok(calls.extended.length >= 3);
});

test("WorkerはProvider Job IDをlease付きで保存して失敗時にも保持する", async () => {
  const { client, calls } = workerClient();
  const base = new MockCloudImageProvider();
  const provider = {
    capability: base.capability,
    async generate(_input, context) {
      await context.checkpointProviderJobId("provider-job-checkpointed");
      throw new Error("provider stopped after checkpoint");
    },
  };
  const result = await processNextCloudGenerationJob({
    workerId: "checkpoint-worker",
    providers: [provider],
    client,
  });
  assert.equal(result.status, "failed");
  assert.deepEqual(calls.checkpoints, ["provider-job-checkpointed"]);
  assert.equal(calls.finished[0].p_provider_job_id, "provider-job-checkpointed");
});

test("lease喪失時はProviderを中断しAsset確定とJob完了を行わない", async () => {
  const { client, calls } = workerClient({ extendFails: true });
  const base = new MockCloudImageProvider();
  const provider = {
    capability: base.capability,
    generate(_input, _context, signal) {
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      });
    },
  };
  const result = await processNextCloudGenerationJob({
    workerId: "lost-lease-worker",
    providers: [provider],
    client,
    heartbeatIntervalMs: 10,
    heartbeatToleratedFailures: 0,
  });
  assert.equal(result.status, "lease_lost");
  assert.equal(calls.uploaded, 0);
  assert.equal(calls.completedAssetId, null);
  assert.equal(calls.finished.length, 0);
});

function cleanupClient(removeFails = false) {
  const updates = [];
  const pending = {
    id: "cleanup-1",
    job_id: "job-1",
    bucket_id: "cloud-assets",
    storage_path: "owner/project/orphan.png",
    attempt_count: 1,
  };
  return {
    updates,
    client: {
      from: (table) => {
        assert.equal(table, "cloud_generation_storage_cleanup");
        let updateValue = null;
        return {
          select() {
            return this;
          },
          eq() {
            if (updateValue) {
              updates.push(updateValue);
              return Promise.resolve({ data: null, error: null });
            }
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          async maybeSingle() {
            return { data: pending, error: null };
          },
          update(value) {
            updateValue = value;
            return this;
          },
        };
      },
      storage: {
        from: () => ({
          remove: async () => ({
            data: null,
            error: removeFails ? { message: "still locked" } : null,
          }),
        }),
      },
    },
  };
}

test("cleanup workerは孤立Storageを削除して解決済みにする", async () => {
  const { client, updates } = cleanupClient();
  const result = await processPendingCloudStorageCleanup({ client });
  assert.equal(result.status, "resolved");
  assert.equal(updates[0].status, "resolved");
});

test("cleanup workerは削除再失敗を次回retryへ残す", async () => {
  const { client, updates } = cleanupClient(true);
  const result = await processPendingCloudStorageCleanup({ client });
  assert.equal(result.status, "retrying");
  assert.equal(updates[0].attempt_count, 2);
  assert.equal(updates[0].last_error, "still locked");
});
