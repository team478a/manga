import assert from "node:assert/strict";
import test from "node:test";
import {
  MangaiCloudGatewayImageProvider,
  MangaiCloudGatewayTextProvider,
} from "../src/lib/cloud-ai-gateway-provider.ts";

const context = {
  jobId: "10000000-0000-4000-8000-000000000021",
  projectId: "20000000-0000-4000-8000-000000000021",
  idempotencyKey: "30000000-0000-4000-8000-000000000021",
};
const imageCapability = {
  providerId: "mangai-cloud-image",
  modelId: "general-image-v1",
  kind: "image",
  jobTypes: ["background"],
  policyVersion: "general-v1",
  pricingVersion: "test-v1",
  enabled: true,
};
const textCapability = {
  providerId: "mangai-cloud-text",
  modelId: "general-text-v1",
  kind: "text",
  jobTypes: ["story"],
  policyVersion: "general-v1",
  pricingVersion: "test-v1",
  enabled: true,
};

test("Gateway image adapter sends idempotency and decodes an allowed image", async () => {
  let headers;
  const provider = new MangaiCloudGatewayImageProvider({
    endpoint: "http://localhost:9999/image",
    apiKey: "test-key-at-least-16-characters",
    capability: imageCapability,
    fetcher: async (_url, init) => {
      headers = init.headers;
      return new Response(
        JSON.stringify({
          providerJobId: "provider-1",
          images: [
            {
              base64: Buffer.from("image-bytes").toString("base64"),
              mimeType: "image/png",
              fileName: "output.png",
            },
          ],
          usage: { actualCostMicros: 1200 },
          moderation: { decision: "allow", reasons: [], policyVersion: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  const result = await provider.generate(
    {
      kind: "image",
      jobType: "background",
      prompt: "forest",
      negativePrompt: "",
    },
    context,
  );
  assert.equal(headers["x-mangai-idempotency-key"], context.idempotencyKey);
  assert.equal(result.images[0].fileName, "output.png");
  assert.equal(result.usage.actualCostMicros, 1200);
  assert.equal(result.providerModeration.decision, "allow");
});

test("Gateway text adapter blocks Provider moderation and classifies 429", async () => {
  const blocked = new MangaiCloudGatewayTextProvider({
    endpoint: "http://localhost:9999/text",
    apiKey: "test-key-at-least-16-characters",
    capability: textCapability,
    fetcher: async () =>
      new Response(
        JSON.stringify({
          text: "blocked",
          usage: {},
          moderation: {
            decision: "block",
            reasons: ["adult_content"],
            policyVersion: 1,
          },
        }),
        { status: 200 },
      ),
  });
  await assert.rejects(
    () =>
      blocked.generate(
        { kind: "text", jobType: "story", prompt: "test", negativePrompt: "" },
        context,
      ),
    (error) => error.code === "provider_moderation_blocked" && !error.retryable,
  );
  const limited = new MangaiCloudGatewayTextProvider({
    endpoint: "http://localhost:9999/text",
    apiKey: "test-key-at-least-16-characters",
    capability: textCapability,
    fetcher: async () => new Response("", { status: 429 }),
  });
  await assert.rejects(
    () =>
      limited.generate(
        { kind: "text", jobType: "story", prompt: "test", negativePrompt: "" },
        context,
      ),
    (error) => error.code === "rate_limited" && error.retryable,
  );
});
