import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  MockCloudImageProvider,
  MockCloudTextProvider,
} from "../src/lib/cloud-ai-mock-provider.ts";
import { sanitizeCloudGeneratedImage } from "../src/lib/cloud-creator-contract.ts";

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
