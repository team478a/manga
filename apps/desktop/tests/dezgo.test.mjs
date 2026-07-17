import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  AIProviderError,
  createExternalDispatchPreview,
} from "@mangai/ai-core";
import { resolveDezgoFeatureFlags } from "../dist-main/main/ai/dezgo-feature-flags.js";
import {
  ProviderCredentialError,
  ProviderCredentialStore,
} from "../dist-main/main/ai/provider-credential-store.js";
import {
  DezgoClient,
  DezgoProvider,
  dezgoTextToImageRequestSchema,
} from "../dist-main/main/ai/providers/dezgo.js";
import {
  persistDezgoGenerationResult,
  sanitizeDezgoImage,
} from "../dist-main/main/ai/dezgo-image-pipeline.js";
import {
  DEZGO_QUEUE_POLICY,
  dezgoFailureDisposition,
} from "../dist-main/main/ai/dezgo-queue-policy.js";
import {
  DEZGO_PRICING_VALID_UNTIL,
  dezgoPreviewDimensions,
  estimateDezgoTextToImageCost,
  evaluateDezgoCostGuard,
} from "../dist-main/main/ai/dezgo-cost-guard.js";
import {
  ExternalDispatchApprovalStore,
} from "../dist-main/main/ai/external-dispatch-approval.js";
import { AIService } from "../dist-main/main/ai/service.js";
import { MangaiDatabase } from "../dist-main/main/database.js";

test("Dezgo conservative cost guard checks price age, budget and balance", () => {
  assert.deepEqual(dezgoPreviewDimensions(100, 2049), {
    width: 320,
    height: 1024,
  });
  assert.equal(
    estimateDezgoTextToImageCost({ width: 512, height: 512, steps: 30 })
      .authorizationCostUsd,
    0.002375,
  );
  const large = estimateDezgoTextToImageCost({
    width: 1024,
    height: 1024,
    steps: 150,
  });
  assert.equal(large.publishedBracketEstimateUsd, 0.0905);
  assert.equal(large.authorizationCostUsd, 0.113125);

  const base = {
    width: 512,
    height: 512,
    steps: 30,
    monthlyLimitUsd: 1,
    monthlyActualUsd: 0.1,
    monthlyReservedUsd: 0.2,
    balanceUsd: 2,
    now: new Date("2026-07-17T00:00:00.000Z"),
  };
  assert.equal(evaluateDezgoCostGuard(base).allowed, true);
  assert.equal(
    evaluateDezgoCostGuard({
      ...base,
      now: new Date(Date.parse(DEZGO_PRICING_VALID_UNTIL) + 1),
    }).blockReason,
    "pricing_stale",
  );
  assert.equal(
    evaluateDezgoCostGuard({ ...base, monthlyLimitUsd: null }).blockReason,
    "cost_limit_not_set",
  );
  assert.equal(
    evaluateDezgoCostGuard({ ...base, monthlyLimitUsd: 0.301 }).blockReason,
    "cost_limit_exceeded",
  );
  assert.equal(
    evaluateDezgoCostGuard({ ...base, balanceUsd: null }).blockReason,
    "balance_unavailable",
  );
  assert.equal(
    evaluateDezgoCostGuard({ ...base, balanceUsd: 0.001 }).blockReason,
    "balance_insufficient",
  );
});

test("external cost reservations enforce monthly limits and recover on restart", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-cost-ledger-"));
  const paths = {
    root,
    database: path.join(root, "db.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  let database = new MangaiDatabase(paths);
  try {
    const project = database.createProject({
      title: "Cost ledger",
      subtitle: "",
      description: "",
      genre: "",
      ageRating: "全年齢",
      readingDirection: "rtl",
      width: 512,
      height: 512,
      dpi: 300,
    });
    const projectId = project.project.id;
    database.reserveExternalCost({
      projectId,
      providerId: "dezgo",
      approvalToken: "first-private-token",
      amountUsd: 0.4,
      monthlyLimitUsd: 1,
      createdAt: "2026-07-17T00:00:00.000Z",
    });
    database.reserveExternalCost({
      projectId,
      providerId: "dezgo",
      approvalToken: "second-private-token",
      amountUsd: 0.5,
      monthlyLimitUsd: 1,
      createdAt: "2026-07-18T00:00:00.000Z",
    });
    assert.throws(
      () =>
        database.reserveExternalCost({
          projectId,
          providerId: "dezgo",
          approvalToken: "over-limit-token",
          amountUsd: 0.2,
          monthlyLimitUsd: 1,
          createdAt: "2026-07-19T00:00:00.000Z",
        }),
      /月間費用上限/,
    );
    database.settleExternalCost({
      approvalToken: "first-private-token",
      actualAmountUsd: 0.35,
    });
    database.releaseExternalCostReservation("second-private-token");
    assert.deepEqual(database.externalCostSummary(projectId, "dezgo", "2026-07"), {
      billingMonth: "2026-07",
      actualUsd: 0.35,
      reservedUsd: 0,
      totalUsd: 0.35,
    });
    database.reserveExternalCost({
      projectId,
      providerId: "dezgo",
      approvalToken: "next-month-token",
      amountUsd: 0.8,
      monthlyLimitUsd: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const boundJobId = database.createApprovedExternalGenerationJob({
      approvalToken: "next-month-token",
      projectId,
      providerId: "dezgo",
      modelId: "test-model",
      prompt: "safe background",
      inputJson: { endpoint: "text2image" },
      routeAudit: {
        draft: {
          projectId,
          type: "background",
          sensitivity: "safe",
          requestedTarget: "cloud",
          inputAssetIds: [],
          personPresence: "none",
          hasCharacterReference: false,
          hasCompletedPage: false,
          promptIncludesRestrictedContent: false,
          allInputAssetsExternalAllowed: true,
        },
        context: {
          policy: "safe_assets_only",
          availableTargets: ["cloud"],
          preferLocal: true,
          externalProviderEnabled: true,
          externalCostWithinLimit: true,
          requireExternalConfirmation: true,
          manualApprovalGranted: true,
          customCloudJobTypes: [],
          sensitiveRenderNodeAllowed: false,
          cloudProviderId: "dezgo",
        },
        decision: {
          target: "cloud",
          providerId: "dezgo",
          reason: "explicit_target",
          requiresUserConfirmation: true,
          blocked: false,
        },
        promptSha256: createHash("sha256")
          .update("safe background")
          .digest("hex"),
      },
    });
    database.reserveExternalCost({
      projectId,
      providerId: "dezgo",
      approvalToken: "restart-orphan-token",
      amountUsd: 0.1,
      monthlyLimitUsd: 1,
      createdAt: "2026-08-01T00:01:00.000Z",
    });
    assert.equal(
      fs.readFileSync(paths.database).includes(Buffer.from("next-month-token")),
      false,
    );
    database.close();
    database = new MangaiDatabase(paths);
    assert.equal(
      database.externalCostSummary(projectId, "dezgo", "2026-08").reservedUsd,
      0.8,
    );
    assert.equal(
      database.externalCostSummary(projectId, "dezgo", "2026-07").actualUsd,
      0.35,
    );
    assert.equal(database.releaseExternalCostReservationForJob(boundJobId), true);
    assert.equal(
      database.externalCostSummary(projectId, "dezgo", "2026-08").reservedUsd,
      0,
    );
  } finally {
    database.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Dezgo Phase 1 features are disabled by default", () => {
  assert.deepEqual(
    resolveDezgoFeatureFlags({ isPackaged: false, environment: {} }),
    {
      dezgoProviderEnabled: false,
      dezgoDirectByokEnabled: false,
      dezgoDispatchEnabled: false,
      dezgoAdultGenerationEnabled: false,
      dezgoBatchGenerationEnabled: false,
    },
  );
});

test("development requires separate provider and BYOK opt-ins", () => {
  assert.deepEqual(
    resolveDezgoFeatureFlags({
      isPackaged: false,
      environment: {
        MANGAI_ENABLE_DEZGO_PROVIDER: "true",
        MANGAI_ENABLE_DEZGO_DIRECT_BYOK: "true",
        MANGAI_ENABLE_DEZGO_DISPATCH: "true",
        MANGAI_ENABLE_DEZGO_ADULT: "true",
        MANGAI_ENABLE_DEZGO_BATCH: "true",
      },
    }),
    {
      dezgoProviderEnabled: true,
      dezgoDirectByokEnabled: true,
      dezgoDispatchEnabled: true,
      dezgoAdultGenerationEnabled: false,
      dezgoBatchGenerationEnabled: false,
    },
  );
  assert.equal(
    resolveDezgoFeatureFlags({
      isPackaged: false,
      environment: { MANGAI_ENABLE_DEZGO_DIRECT_BYOK: "true" },
    }).dezgoDirectByokEnabled,
    false,
  );
});

test("packaged builds ignore all Phase 1 environment opt-ins", () => {
  assert.deepEqual(
    resolveDezgoFeatureFlags({
      isPackaged: true,
      environment: {
        MANGAI_ENABLE_DEZGO_PROVIDER: "true",
        MANGAI_ENABLE_DEZGO_DIRECT_BYOK: "true",
        MANGAI_ENABLE_DEZGO_DISPATCH: "true",
      },
    }),
    {
      dezgoProviderEnabled: false,
      dezgoDirectByokEnabled: false,
      dezgoDispatchEnabled: false,
      dezgoAdultGenerationEnabled: false,
      dezgoBatchGenerationEnabled: false,
    },
  );
});

function memoryKeyring(options = {}) {
  let password;
  return {
    factory: async (service, account) => {
      assert.equal(service, "MANGAI Desktop");
      assert.equal(account, "image-provider.dezgo.api-key");
      if (options.factoryError) throw options.factoryError;
      return {
        async setPassword(value) {
          if (options.writeError) throw options.writeError;
          password = value;
        },
        async getPassword() {
          if (options.readError) throw options.readError;
          return password;
        },
        async deleteCredential() {
          if (options.deleteError) throw options.deleteError;
          const existed = Boolean(password);
          password = undefined;
          return existed;
        },
      };
    },
    current: () => password,
  };
}

test("provider credentials use a fixed OS keyring account and can be deleted", async () => {
  const keyring = memoryKeyring();
  const store = new ProviderCredentialStore(keyring.factory);
  assert.equal(await store.has("dezgo"), false);
  await store.set("dezgo", "  dezgo-secret-value  ");
  assert.equal(keyring.current(), "dezgo-secret-value");
  assert.equal(await store.has("dezgo"), true);
  assert.equal(await store.get("dezgo"), "dezgo-secret-value");
  assert.equal(await store.delete("dezgo"), true);
  assert.equal(await store.has("dezgo"), false);
});

test("provider credential errors fail closed without exposing the secret", async () => {
  const secret = "dezgo-secret-must-not-leak";
  const keyring = memoryKeyring({ writeError: new Error(`failed ${secret}`) });
  const store = new ProviderCredentialStore(keyring.factory);
  await assert.rejects(store.set("dezgo", secret), (error) => {
    assert.ok(error instanceof ProviderCredentialError);
    assert.equal(error.code, "CREDENTIAL_WRITE_FAILED");
    assert.doesNotMatch(error.message, new RegExp(secret));
    return true;
  });
});

test("provider credentials never fall back when the OS keyring is unavailable", async () => {
  const store = new ProviderCredentialStore(
    memoryKeyring({ factoryError: new Error("native module unavailable") })
      .factory,
  );
  await assert.rejects(store.get("dezgo"), (error) => {
    assert.ok(error instanceof ProviderCredentialError);
    assert.equal(error.code, "CREDENTIAL_STORE_UNAVAILABLE");
    return true;
  });
});

const dezgoInfo = {
  name: "Dezgo",
  version: "test",
  models: [
    {
      id: "model-from-api",
      name: "Model from API",
      family: "sd1",
      description: "Test model",
      license: "test-license",
      categories: ["art"],
      functions: ["text2image", "image2image", "unknown-future-function"],
      nativeResolution: { width: 512, height: 512 },
      triggers: ["test trigger"],
      futureField: true,
    },
  ],
  futureTopLevelField: true,
};

function dezgoFetch(options = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (options.waitForAbort)
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          {
            once: true,
          },
        );
      });
    if (options.status)
      return new Response(options.errorBody ?? "provider error", {
        status: options.status,
      });
    const body = url.endsWith("/info") ? dezgoInfo : { balance: 4.25 };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { calls, fetchImpl };
}

test("Dezgo provider validates credentials and normalizes model metadata", async () => {
  const mock = dezgoFetch();
  const provider = new DezgoProvider(async () => "test-dezgo-api-key", {
    fetchImpl: mock.fetchImpl,
  });
  const connection = await provider.checkConnection();
  assert.equal(connection.ok, true);
  assert.equal(mock.calls.length, 2);
  for (const call of mock.calls) {
    assert.equal(new URL(call.url).origin, "https://api.dezgo.com");
    assert.equal(call.init.redirect, "error");
    assert.equal(call.init.headers["X-Dezgo-Key"], "test-dezgo-api-key");
  }

  const models = await provider.listModels();
  assert.deepEqual(models[0], {
    id: "model-from-api",
    name: "Model from API",
    family: "sd1",
    description: "Test model",
    license: "test-license",
    categories: ["art"],
    supportedFunctions: ["text_to_image", "image_to_image"],
    nativeResolution: { width: 512, height: 512 },
    triggers: ["test trigger"],
    fetchedAt: models[0].fetchedAt,
  });
  assert.match(models[0].fetchedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(await provider.getBalance(), 4.25);
});

test("Dezgo HTTP errors are classified without exposing keys or response bodies", async () => {
  const secret = "test-dezgo-api-key-must-not-leak";
  const mock = dezgoFetch({
    status: 401,
    errorBody: `invalid key ${secret}`,
  });
  const client = new DezgoClient(async () => secret, mock.fetchImpl);
  await assert.rejects(client.balance(), (error) => {
    assert.equal(error.code, "DEZGO_API_KEY_INVALID");
    assert.doesNotMatch(error.message, new RegExp(secret));
    assert.doesNotMatch(error.message, /invalid key/);
    assert.equal(error.retryable, false);
    return true;
  });
});

test("Dezgo connection timeout aborts the request with a fixed message", async () => {
  const mock = dezgoFetch({ waitForAbort: true });
  const client = new DezgoClient(
    async () => "test-dezgo-api-key",
    mock.fetchImpl,
    10,
  );
  await assert.rejects(client.info(), (error) => {
    assert.equal(error.code, "DEZGO_TIMEOUT");
    assert.equal(error.retryable, true);
    return true;
  });
  assert.equal(mock.calls[0].init.signal.aborted, true);
});

test("Dezgo generation remains disabled while read-only Phase 1 setup is built", async () => {
  const provider = new DezgoProvider(async () => "test-dezgo-api-key", {
    fetchImpl: dezgoFetch().fetchImpl,
  });
  await assert.rejects(provider.generateImage({}), (error) => {
    assert.equal(error.code, "DEZGO_GENERATION_DISABLED");
    return true;
  });
});

test("Dezgo text-to-image maps one JSON request and parses safe billing metadata", async () => {
  const source = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 20, g: 80, b: 140, alpha: 1 },
    },
  })
    .withMetadata({ exif: { IFD0: { Copyright: "must-be-removed" } } })
    .png()
    .toBuffer();
  const calls = [];
  const client = new DezgoClient(
    async () => "secret-test-key",
    async (url, init) => {
      calls.push({ url, init });
      return new Response(source, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "x-input-seed": "1234",
          "x-dezgo-job-amount-usd": "0.0125",
          "x-dezgo-balance-total-usd": "4.2375",
          "x-dezgo-balance-index": "42",
          "x-dezgo-auth-userid": "must-not-be-recorded",
        },
      });
    },
  );
  const request = {
    prompt: "empty manga classroom",
    negativePrompt: "people, text",
    model: "model-from-api",
    width: 512,
    height: 768,
    guidance: 7,
    steps: 30,
    sampler: "dpmpp_2m_karras",
    seed: 1234,
    format: "png",
  };
  const result = await client.textToImage(request);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.dezgo.com/text2image");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(calls[0].init.headers["X-Dezgo-Key"], "secret-test-key");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    prompt: "empty manga classroom",
    negative_prompt: "people, text",
    model: "model-from-api",
    width: 512,
    height: 768,
    guidance: 7,
    steps: 30,
    sampler: "dpmpp_2m_karras",
    seed: 1234,
    format: "png",
  });
  assert.equal(result.images.length, 1);
  assert.equal(result.images[0].mimeType, "image/png");
  assert.deepEqual(result.metadata, {
    seed: 1234,
    actualCostUsd: 0.0125,
    balanceUsd: 4.2375,
    balanceIndex: 42,
  });
  assert.equal(JSON.stringify(result).includes("secret-test-key"), false);
  assert.equal(JSON.stringify(result).includes("must-not-be-recorded"), false);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-dezgo-image-"));
  const database = new MangaiDatabase({
    root,
    database: path.join(root, "db.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  });
  try {
    const project = database.createProject({
      title: "Dezgo mock image",
      subtitle: "",
      description: "",
      genre: "漫画",
      ageRating: "全年齢",
      readingDirection: "rtl",
      width: 512,
      height: 768,
      dpi: 300,
    });
    const jobId = database.createGenerationJob({
      projectId: project.project.id,
      providerType: "image",
      providerId: "dezgo",
      modelId: request.model,
      generationType: "image",
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      inputJson: request,
    });
    database.updateGenerationJob(jobId, "running", { progress: 0.8 });
    const persisted = await persistDezgoGenerationResult(database, {
      jobId,
      projectId: project.project.id,
      request,
      result,
      durationMs: 1250,
      jobType: "background",
      libraryTags: ["classroom"],
    });
    assert.equal(persisted.bundle.assets.length, 1);
    assert.equal(persisted.assetId, persisted.bundle.assets[0].id);
    assert.equal(persisted.bundle.assets[0].libraryCategory, "background");
    const assetFile = path.join(
      persisted.bundle.project.storagePath,
      persisted.bundle.assets[0].relativePath,
    );
    const sanitizedMetadata = await sharp(assetFile).metadata();
    assert.equal(sanitizedMetadata.format, "png");
    assert.equal(sanitizedMetadata.exif, undefined);
    assert.equal(sanitizedMetadata.icc, undefined);
    assert.equal(sanitizedMetadata.xmp, undefined);
    const savedJob = database.listGenerationJobs(project.project.id)[0];
    assert.equal(savedJob.status, "completed");
    assert.equal(savedJob.providerId, "dezgo");
    assert.equal(savedJob.modelId, "model-from-api");
    assert.equal(JSON.parse(savedJob.outputJson).actualCostUsd, 0.0125);
    assert.equal(savedJob.outputJson.includes("empty manga classroom"), false);
    assert.equal(savedJob.outputJson.includes("secret-test-key"), false);
  } finally {
    database.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Dezgo text-to-image rejects invalid parameters and non-image responses", async () => {
  const valid = {
    prompt: "empty room",
    negativePrompt: "people",
    model: "model-from-api",
    width: 512,
    height: 512,
    guidance: 7,
    steps: 30,
    sampler: "dpmpp_2m_karras",
    format: "png",
  };
  assert.throws(() =>
    dezgoTextToImageRequestSchema.parse({ ...valid, width: 513 }),
  );
  assert.throws(() =>
    dezgoTextToImageRequestSchema.parse({
      ...valid,
      prompt: "x".repeat(1001),
    }),
  );
  const client = new DezgoClient(
    async () => "secret-test-key",
    async () =>
      new Response('{"error":"secret provider body"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  await assert.rejects(client.textToImage(valid), (error) => {
    assert.equal(error.code, "DEZGO_IMAGE_INVALID");
    assert.doesNotMatch(error.message, /secret provider body/);
    return true;
  });
  await assert.rejects(sanitizeDezgoImage(Buffer.from("not-an-image")));
});

test("Dezgo model metadata survives the SQLite cache", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-dezgo-cache-"));
  const database = new MangaiDatabase({
    root,
    database: path.join(root, "db.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  });
  try {
    database.saveAIModels("dezgo", [
      {
        id: "cached-model",
        name: "Cached model",
        family: "sdxl",
        categories: ["anime"],
        supportedFunctions: ["text_to_image"],
        nativeResolution: { width: 1024, height: 1024 },
        triggers: null,
        fetchedAt: "2026-07-17T00:00:00.000Z",
      },
    ]);
    const cached = database.listAIModels("dezgo")[0];
    assert.equal(cached.family, "sdxl");
    assert.deepEqual(cached.categories, ["anime"]);
    assert.deepEqual(cached.supportedFunctions, ["text_to_image"]);
    assert.deepEqual(cached.nativeResolution, { width: 1024, height: 1024 });
    assert.equal(cached.cached, true);
  } finally {
    database.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Dezgo queue retry policy only retries rate limits and service errors once", () => {
  assert.deepEqual(DEZGO_QUEUE_POLICY, {
    maxConcurrentJobs: 1,
    maxActiveJobs: 20,
    maxAttempts: 2,
  });
  assert.equal(
    dezgoFailureDisposition(
      new AIProviderError("DEZGO_RATE_LIMITED", "busy", true),
      1,
    ),
    "retry",
  );
  assert.equal(
    dezgoFailureDisposition(
      new AIProviderError("DEZGO_SERVICE_ERROR", "unavailable", true),
      2,
    ),
    "fail",
  );
  assert.equal(
    dezgoFailureDisposition(
      new AIProviderError("DEZGO_CONNECTION_FAILED", "offline", true),
      1,
    ),
    "hold",
  );
  for (const code of [
    "DEZGO_INPUT_INVALID",
    "DEZGO_API_KEY_INVALID",
    "DEZGO_BALANCE_INSUFFICIENT",
    "DEZGO_NOT_ALLOWED",
    "DEZGO_NOT_FOUND",
    "DEZGO_TIMEOUT",
  ])
    assert.equal(
      dezgoFailureDisposition(new AIProviderError(code, "stop", true), 1),
      "fail",
    );
});

test("Dezgo queue enforces capacity, cancellation, provider isolation and restart recovery", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-dezgo-queue-"));
  const paths = {
    root,
    database: path.join(root, "db.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  let database = new MangaiDatabase(paths);
  try {
    const project = database.createProject({
      title: "Dezgo queue",
      subtitle: "",
      description: "",
      genre: "",
      ageRating: "全年齢",
      readingDirection: "rtl",
      width: 512,
      height: 512,
      dpi: 300,
    });
    const enqueue = (index) =>
      database.createGenerationJob({
        projectId: project.project.id,
        providerType: "cloud",
        providerId: "dezgo",
        modelId: "test-model",
        generationType: "image",
        prompt: `safe background ${index}`,
        inputJson: { providerId: "dezgo", index },
      });
    const jobs = Array.from(
      { length: DEZGO_QUEUE_POLICY.maxActiveJobs },
      (_, index) => enqueue(index),
    );
    assert.equal(database.countActiveGenerationJobs("dezgo"), 20);
    assert.throws(() => enqueue(20), /20件まで/);
    assert.equal(database.nextQueuedImageJob(["comfyui"]), undefined);
    assert.equal(database.nextQueuedImageJob(["dezgo"]).id, jobs[0]);

    new AIService(database).cancel(jobs[0]);
    assert.equal(database.countActiveGenerationJobs("dezgo"), 19);
    const replacement = enqueue(21);
    assert.ok(replacement);
    database.updateGenerationJob(jobs[1], "running", { progress: 0.5 });

    database.close();
    database = new MangaiDatabase(paths);
    const recovered = database
      .listGenerationJobs(project.project.id)
      .find((job) => job.id === jobs[1]);
    assert.equal(recovered.status, "queued");
    assert.equal(recovered.errorCode, "RECOVERED_AFTER_RESTART");
    assert.equal(recovered.maxAttempts, 2);

    assert.deepEqual(database.beginGenerationJobAttempt(jobs[1]), {
      attemptCount: 1,
      maxAttempts: 2,
    });
    assert.equal(
      database.requeueGenerationJob(
        jobs[1],
        "DEZGO_RATE_LIMITED",
        "retry",
        10,
      ),
      true,
    );
    assert.deepEqual(database.beginGenerationJobAttempt(jobs[1]), {
      attemptCount: 2,
      maxAttempts: 2,
    });
    assert.equal(
      database.requeueGenerationJob(
        jobs[1],
        "DEZGO_SERVICE_ERROR",
        "stop",
        10,
      ),
      false,
    );
  } finally {
    database.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("guarded Dezgo dispatcher resumes an approved job and persists mocked output", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-dezgo-dispatch-"));
  const database = new MangaiDatabase({
    root,
    database: path.join(root, "db.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  });
  const flags = (dezgoDispatchEnabled) => ({
    dezgoProviderEnabled: true,
    dezgoDirectByokEnabled: true,
    dezgoDispatchEnabled,
    dezgoAdultGenerationEnabled: false,
    dezgoBatchGenerationEnabled: false,
  });
  try {
    const project = database.createProject({
      title: "Dezgo dispatcher",
      subtitle: "",
      description: "",
      genre: "漫画",
      ageRating: "全年齢",
      readingDirection: "rtl",
      width: 512,
      height: 512,
      dpi: 300,
    });
    database.saveProjectGenerationPolicy({
      projectId: project.project.id,
      externalProcessingPolicy: "background_only",
      preferLocal: true,
      externalConfirmationRequired: true,
      monthlyCostLimit: 10,
      customCloudJobTypes: [],
    });
    database.saveAIModels("dezgo", [
      {
        id: "mock-safe-model",
        name: "Mock safe model",
        supportedFunctions: ["text_to_image"],
        fetchedAt: new Date().toISOString(),
      },
    ]);
    const queueService = new AIService(database, {
      getProviderCredential: async () => "mock-key",
      getDezgoBalance: async () => 10,
      dezgoFeatures: flags(false),
    });
    const enqueue = async (query) => {
      const preview = await queueService.previewExternalSafeAsset({
        projectId: project.project.id,
        type: "background",
        query,
        modelId: "mock-safe-model",
      });
      assert.equal(preview.executable, true);
      return queueService.confirmAndEnqueueExternalSafeAsset({
        previewId: preview.previewId,
        promptSha256: preview.promptSha256,
        payloadReviewed: true,
        costReviewed: true,
        providerTermsReviewed: true,
        confirmedAt: new Date().toISOString(),
      });
    };
    const queued = await enqueue("人物を含まない漫画背景");
    let calls = 0;
    const disabledWorker = new AIService(database, {
      dezgoFeatures: flags(false),
      createDezgoProvider: () => ({
        textToImage: async () => {
          calls += 1;
          throw new Error("must not run");
        },
      }),
    });
    assert.equal(await disabledWorker.runNextQueuedDezgo(), null);
    assert.equal(calls, 0);

    const image = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 4,
        background: { r: 30, g: 120, b: 80, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    let dispatchedRequest;
    const worker = new AIService(database, {
      dezgoFeatures: flags(true),
      createDezgoProvider: () => ({
        textToImage: async (request) => {
          calls += 1;
          dispatchedRequest = request;
          return {
            providerJobId: "mock-provider-job",
            images: [{ bytes: new Uint8Array(image), mimeType: "image/png" }],
            metadata: {
              seed: 9876,
              actualCostUsd: 0.001,
              balanceUsd: 9.999,
              balanceIndex: 7,
            },
          };
        },
      }),
    });
    const completed = await worker.runNextQueuedDezgo();
    assert.equal(completed.status, "completed");
    assert.equal(completed.jobId, queued.jobId);
    assert.equal(calls, 1);
    assert.equal(dispatchedRequest.prompt, "人物を含まない漫画背景");
    assert.equal(dispatchedRequest.model, "mock-safe-model");
    const saved = database
      .listGenerationJobs(project.project.id)
      .find((job) => job.id === queued.jobId);
    assert.equal(saved.status, "completed");
    assert.equal(saved.providerJobId, "mock-provider-job");
    const output = JSON.parse(saved.outputJson);
    assert.equal(output.accountedCostUsd, 0.001);
    assert.equal(output.billingAmountSource, "provider_header");
    assert.equal(output.jobType, "background");
    assert.equal(saved.outputJson.includes("mock-key"), false);
    const summary = database.externalCostSummary(
      project.project.id,
      "dezgo",
    );
    assert.equal(summary.actualUsd, 0.001);
    assert.equal(summary.reservedUsd, 0);
    assert.ok(database.bundle(project.project.id).assets.length > 0);

    const failedQueue = await enqueue("失敗確認用の無人背景");
    const failingWorker = new AIService(database, {
      dezgoFeatures: flags(true),
      createDezgoProvider: () => ({
        textToImage: async () => {
          throw new AIProviderError(
            "DEZGO_INPUT_INVALID",
            "mock input failure",
          );
        },
      }),
    });
    const failed = await failingWorker.runNextQueuedDezgo();
    assert.equal(failed.status, "failed");
    const failedJob = database
      .listGenerationJobs(project.project.id)
      .find((job) => job.id === failedQueue.jobId);
    assert.equal(failedJob.status, "failed");
    assert.equal(failedJob.errorCode, "DEZGO_INPUT_INVALID");
    assert.equal(
      database.externalCostSummary(project.project.id, "dezgo").reservedUsd,
      0,
    );
  } finally {
    database.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("external dispatch approval binds one request and expires after one use", () => {
  let nowMs = Date.parse("2026-07-17T03:00:00.000Z");
  const now = () => new Date(nowMs);
  const approvals = new ExternalDispatchApprovalStore(
    now,
    5 * 60_000,
    60_000,
  );
  const request = {
    projectId: randomUUID(),
    pageId: randomUUID(),
    type: "background",
    query: "empty manga city at night",
  };
  const contextSha256 = createHash("sha256")
    .update("policy-v1")
    .digest("hex");
  const previewFor = (value = request, estimate = true) =>
    createExternalDispatchPreview({
      previewId: randomUUID(),
      request: value,
      promptSha256: createHash("sha256")
        .update(value.query, "utf8")
        .digest("hex"),
      policy: "safe_assets_only",
      provider: {
        providerId: "dezgo",
        displayName: "Dezgo API",
        enabled: true,
        endpointConfigured: true,
        supportedJobTypes: ["background", "prop", "effect"],
        dataRetentionSummary: "30 days",
        trainingUseSummary: "unknown",
        pricingSummary: "estimated",
      },
      estimate: estimate ? { cost: 0.01, currency: "usd" } : undefined,
      createdAt: now().toISOString(),
    });
  const confirmationFor = (preview) => ({
    previewId: preview.previewId,
    promptSha256: preview.promptSha256,
    payloadReviewed: true,
    costReviewed: true,
    providerTermsReviewed: true,
    confirmedAt: now().toISOString(),
  });

  const preview = previewFor();
  approvals.register(preview, request, contextSha256);
  const approval = approvals.confirm(
    confirmationFor(preview),
    contextSha256,
  );
  assert.equal(approval.previewId, preview.previewId);
  assert.equal(
    JSON.stringify(approval).includes("empty manga city at night"),
    false,
  );
  const consumed = approvals.consume(approval.approvalToken);
  assert.deepEqual(consumed.request, request);
  assert.equal(consumed.preview.promptSha256, preview.promptSha256);
  assert.throws(
    () => approvals.consume(approval.approvalToken),
    (error) => error?.code === "APPROVAL_TOKEN_INVALID",
  );
  assert.throws(
    () =>
      new ExternalDispatchApprovalStore(now).consume(approval.approvalToken),
    (error) => error?.code === "APPROVAL_TOKEN_INVALID",
  );

  const alteredPreview = previewFor();
  approvals.register(alteredPreview, request, contextSha256);
  assert.throws(
    () =>
      approvals.confirm(
        {
          ...confirmationFor(alteredPreview),
          promptSha256: "0".repeat(64),
        },
        contextSha256,
      ),
    (error) => error?.code === "CONFIRMATION_MISMATCH",
  );

  const contextPreview = previewFor();
  approvals.register(contextPreview, request, contextSha256);
  assert.throws(
    () => approvals.confirm(confirmationFor(contextPreview), "1".repeat(64)),
    (error) => error?.code === "CONTEXT_CHANGED",
  );

  const blockedPreview = previewFor(request, false);
  approvals.register(blockedPreview, request, contextSha256);
  assert.throws(
    () => approvals.confirm(confirmationFor(blockedPreview), contextSha256),
    (error) => error?.code === "PREVIEW_BLOCKED",
  );

  const expiredPreview = previewFor();
  approvals.register(expiredPreview, request, contextSha256);
  nowMs += 5 * 60_000 + 1;
  assert.throws(
    () => approvals.confirm(confirmationFor(expiredPreview), contextSha256),
    (error) => error?.code === "PREVIEW_EXPIRED",
  );

  const tokenPreview = previewFor();
  approvals.register(tokenPreview, request, contextSha256);
  const expiringApproval = approvals.confirm(
    confirmationFor(tokenPreview),
    contextSha256,
  );
  nowMs += 60_001;
  assert.throws(
    () => approvals.consume(expiringApproval.approvalToken),
    (error) => error?.code === "APPROVAL_TOKEN_EXPIRED",
  );

  const mismatchedRequest = { ...request, projectId: randomUUID() };
  assert.throws(
    () => approvals.register(previewFor(), mismatchedRequest, contextSha256),
    (error) => error?.code === "PREVIEW_REQUEST_MISMATCH",
  );
  const modelRequest = { ...request, modelId: "approved-model" };
  const modelPreview = previewFor(modelRequest);
  assert.throws(
    () =>
      approvals.register(
        modelPreview,
        { ...modelRequest, modelId: "substituted-model" },
        contextSha256,
      ),
    (error) => error?.code === "PREVIEW_REQUEST_MISMATCH",
  );
});
