import assert from "node:assert/strict";
import test from "node:test";
import { BlackForestLabsFluxImageProvider } from "../src/lib/cloud-flux-image-provider.ts";

const capability = {
  providerId: "black-forest-labs",
  modelId: "flux-2-pro",
  kind: "image",
  jobTypes: ["background"],
  policyVersion: "general-v1",
  pricingVersion: "bfl-flux2-2026-03",
  enabled: true,
};
const context = {
  jobId: "10000000-0000-4000-8000-000000000031",
  projectId: "20000000-0000-4000-8000-000000000031",
  idempotencyKey: "30000000-0000-4000-8000-000000000031",
};

test("BFL adapter submits a strict general request, polls, and downloads immediately", async () => {
  const calls = [];
  const provider = new BlackForestLabsFluxImageProvider({
    apiKey: "bfl-test-key-with-at-least-twenty-characters",
    model: "flux-2-pro",
    capability,
    pollIntervalMs: 1,
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      if (calls.length === 1)
        return new Response(
          JSON.stringify({
            id: "bfl-job-1",
            polling_url: "https://api.bfl.ai/v1/get_result?id=bfl-job-1",
          }),
          { status: 200 },
        );
      if (calls.length === 2)
        return new Response(
          JSON.stringify({
            status: "Ready",
            result: {
              sample: "https://delivery.bfl.ai/result/output.png",
            },
          }),
          { status: 200 },
        );
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    },
  });
  const result = await provider.generate(
    {
      kind: "image",
      jobType: "background",
      prompt: "quiet manga street",
      negativePrompt: "letters",
      width: 1001,
      height: 999,
    },
    context,
  );
  const request = JSON.parse(calls[0].init.body);
  assert.equal(calls[0].url, "https://api.bfl.ai/v1/flux-2-pro");
  assert.equal(calls[0].init.headers["x-key"].startsWith("bfl-"), true);
  assert.equal(request.safety_tolerance, 1);
  assert.equal(request.width % 16, 0);
  assert.match(request.prompt, /Avoid: letters/);
  assert.equal(result.providerJobId, "bfl-job-1");
  assert.equal(result.usage.actualCostMicros, 30_000);
  assert.equal(result.providerModeration.decision, "allow");
});

test("BFL adapter rejects untrusted polling URLs before making a second request", async () => {
  let calls = 0;
  const provider = new BlackForestLabsFluxImageProvider({
    apiKey: "bfl-test-key-with-at-least-twenty-characters",
    model: "flux-2-pro",
    capability,
    pollIntervalMs: 1,
    fetcher: async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          id: "bfl-job-2",
          polling_url: "https://example.invalid/internal",
        }),
        { status: 200 },
      );
    },
  });
  await assert.rejects(
    () =>
      provider.generate(
        {
          kind: "image",
          jobType: "background",
          prompt: "forest",
          negativePrompt: "",
        },
        context,
      ),
    (error) => error.code === "provider_rejected" && !error.retryable,
  );
  assert.equal(calls, 1);
});

test("BFL adapterは署名済み参照画像をmulti-reference入力へ渡す", async () => {
  const calls = [];
  const provider = new BlackForestLabsFluxImageProvider({
    apiKey: "bfl-test-key-with-at-least-twenty-characters",
    model: "flux-2-pro",
    capability,
    pollIntervalMs: 1,
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      if (calls.length === 1) return new Response(JSON.stringify({
        id: "bfl-job-reference",
        polling_url: "https://api.bfl.ai/v1/get_result?id=bfl-job-reference",
      }), { status: 200 });
      if (calls.length === 2) return new Response(JSON.stringify({
        status: "Ready",
        result: { sample: "https://delivery.bfl.ai/result/reference.png" },
      }), { status: 200 });
      return new Response(new Uint8Array([137,80,78,71]), { status: 200 });
    },
  });
  await provider.generate({
    kind: "image",
    jobType: "background",
    prompt: "manga panel",
    negativePrompt: "",
  }, {
    ...context,
    referenceImageUrls: [
      "https://project.supabase.co/storage/v1/object/sign/cloud-assets/a.png?token=one",
      "https://project.supabase.co/storage/v1/object/sign/cloud-assets/b.png?token=two",
    ],
  });
  const request = JSON.parse(calls[0].init.body);
  assert.match(request.input_image, /a\.png/);
  assert.match(request.input_image_2, /b\.png/);
});

test("BFL Fill adapterは元画像と白黒マスクをbase64で送信する", async () => {
  const calls = [];
  const fillCapability = {
    ...capability,
    modelId: "flux-pro-1.0-fill",
    operations: ["inpainting"],
    pricingVersion: "bfl-flux1-fill-2026-08",
  };
  const provider = new BlackForestLabsFluxImageProvider({
    apiKey: "bfl-test-key-with-at-least-twenty-characters",
    model: "flux-pro-1.0-fill",
    capability: fillCapability,
    pollIntervalMs: 1,
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      if (calls.length <= 2)
        return new Response(new Uint8Array([137, 80, 78, 71]), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      if (calls.length === 3)
        return new Response(JSON.stringify({
          id: "bfl-fill-1",
          polling_url: "https://api.bfl.ai/v1/get_result?id=bfl-fill-1",
        }), { status: 200 });
      if (calls.length === 4)
        return new Response(JSON.stringify({
          status: "Ready",
          result: { sample: "https://delivery.bfl.ai/result/fill.png" },
        }), { status: 200 });
      return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
    },
  });
  const result = await provider.generate({
    kind: "image",
    jobType: "background",
    prompt: "repair only the selected hand",
    negativePrompt: "letters",
    operation: "inpainting",
    sourceAssetId: "40000000-0000-4000-8000-000000000031",
    maskAssetId: "50000000-0000-4000-8000-000000000031",
    referenceAssetIds: ["40000000-0000-4000-8000-000000000031"],
  }, {
    ...context,
    referenceImageUrls: ["https://project.supabase.co/source.png?token=one"],
    maskImageUrl: "https://project.supabase.co/mask.png?token=two",
  });
  const request = JSON.parse(calls[2].init.body);
  assert.equal(calls[2].url, "https://api.bfl.ai/v1/flux-pro-1.0-fill");
  assert.equal(request.image, Buffer.from([137, 80, 78, 71]).toString("base64"));
  assert.equal(request.mask, Buffer.from([137, 80, 78, 71]).toString("base64"));
  assert.equal("input_image" in request, false);
  assert.equal(result.usage.actualCostMicros, 50_000);
});
