import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createExternalDispatchPreview,
  externalDispatchConfirmationSchema,
  generationJobDraftSchema,
  routeGenerationJob,
  recommendRuntimeProfile,
  runtimeLimits,
  constrainImageDimensions,
  isGenerationQueueWindowOpen,
  minutesUntilGenerationQueueWindow,
  analyzeComfyWorkflowOptimization,
  imageGenerationProviderIdSchema,
  imageGenerationJobTypeSchema,
  adultGenerationGateInputSchema,
  evaluateAdultGenerationGate,
  imageJobRequestSchema,
  reviewAdultGenerationPrompt,
} from "../dist/index.js";

const projectId = randomUUID();

test("image generation provider identifiers preserve ComfyUI and allow future adapters", () => {
  assert.equal(imageGenerationProviderIdSchema.parse("dezgo"), "dezgo");
  assert.equal(imageGenerationProviderIdSchema.parse("comfyui"), "comfyui");
  assert.equal(
    imageGenerationProviderIdSchema.parse("local_comfyui"),
    "local_comfyui",
  );
  assert.throws(() => imageGenerationProviderIdSchema.parse("unknown"));
});

test("image generation job types include Phase 1 and later capabilities", () => {
  assert.equal(
    imageGenerationJobTypeSchema.parse("text_to_image"),
    "text_to_image",
  );
  assert.equal(imageGenerationJobTypeSchema.parse("controlnet"), "controlnet");
  assert.throws(() => imageGenerationJobTypeSchema.parse("batch"));
});

const adultGateAllowedInput = {
  userConfirmed18Plus: true,
  projectAgeRating: "成人向け",
  jobType: "adult_character_render",
  characterIsFictional: true,
  allDepictedCharactersExplicitly18Plus: true,
  minorOrAgeAmbiguousAppearanceDetected: false,
  realPersonReferenceIncluded: false,
  nonConsensualOrExploitativeContentDetected: false,
  rightsConfirmed: true,
  localPolicyReviewPassed: true,
  externalTransmissionReviewed: true,
  administratorAdultGenerationEnabled: true,
  providerAdultCommercialUseApproval: "approved",
  providerApprovalReferenceSha256: "a".repeat(64),
  selectedModelAdultUseApproved: true,
  adultGenerationFeatureEnabled: true,
};

test("adult external generation gate fails closed on incomplete input", () => {
  const parsed = adultGenerationGateInputSchema.parse({});
  assert.equal(parsed.userConfirmed18Plus, false);
  assert.equal(parsed.minorOrAgeAmbiguousAppearanceDetected, true);
  assert.equal(parsed.realPersonReferenceIncluded, true);
  assert.equal(
    evaluateAdultGenerationGate({}).reason,
    "user_age_not_confirmed",
  );
});

test("adult external generation gate requires provider evidence and feature enablement", () => {
  assert.deepEqual(
    evaluateAdultGenerationGate({
      ...adultGateAllowedInput,
      providerAdultCommercialUseApproval: "unverified",
      providerApprovalReferenceSha256: undefined,
    }),
    { allowed: false, reason: "provider_approval_missing" },
  );
  assert.deepEqual(
    evaluateAdultGenerationGate({
      ...adultGateAllowedInput,
      adultGenerationFeatureEnabled: false,
    }),
    { allowed: false, reason: "feature_disabled" },
  );
});

test("adult external generation gate rejects minors, real people and exploitation", () => {
  const cases = [
    [
      { allDepictedCharactersExplicitly18Plus: false },
      "depicted_adult_age_not_confirmed",
    ],
    [
      { minorOrAgeAmbiguousAppearanceDetected: true },
      "minor_or_age_ambiguous",
    ],
    [{ realPersonReferenceIncluded: true }, "real_person_reference"],
    [
      { nonConsensualOrExploitativeContentDetected: true },
      "nonconsensual_or_exploitative_content",
    ],
  ];
  for (const [override, reason] of cases)
    assert.deepEqual(
      evaluateAdultGenerationGate({ ...adultGateAllowedInput, ...override }),
      { allowed: false, reason },
    );
  assert.deepEqual(evaluateAdultGenerationGate(adultGateAllowedInput), {
    allowed: true,
    reason: null,
  });
});

const adultContentConfirmation = {
  fictionalAdultsOnly: true,
  allCharacters18Plus: true,
  noMinorOrAgeAmbiguousAppearance: true,
  noRealPersonReference: true,
  consensualAndNonExploitativeOnly: true,
  rightsConfirmed: true,
};
const adultImageRequest = {
  projectId,
  workflowId: randomUUID(),
  prompt: "fictional adult characters, both explicitly age 25",
  jobType: "adult_character_render",
  adultContentConfirmation,
};

test("adult image requests require every content confirmation", () => {
  assert.equal(
    imageJobRequestSchema.parse(adultImageRequest).jobType,
    "adult_character_render",
  );
  assert.throws(() =>
    imageJobRequestSchema.parse({
      ...adultImageRequest,
      adultContentConfirmation: undefined,
    }),
  );
  assert.throws(() =>
    imageJobRequestSchema.parse({
      ...adultImageRequest,
      adultContentConfirmation: {
        ...adultContentConfirmation,
        allCharacters18Plus: false,
      },
    }),
  );
});

test("adult confirmation cannot be attached to an ordinary image request", () => {
  assert.throws(() =>
    imageJobRequestSchema.parse({
      ...adultImageRequest,
      jobType: "background",
    }),
  );
});

test("adult prompt review blocks minor, real-person and non-consensual signals", () => {
  assert.deepEqual(reviewAdultGenerationPrompt("16 years old character"), {
    allowed: false,
    reason: "minor_or_age_ambiguous",
  });
  assert.deepEqual(reviewAdultGenerationPrompt("celebrity deepfake"), {
    allowed: false,
    reason: "real_person_reference",
  });
  assert.deepEqual(reviewAdultGenerationPrompt("non-consensual scene"), {
    allowed: false,
    reason: "nonconsensual_or_exploitative_content",
  });
  assert.deepEqual(
    reviewAdultGenerationPrompt("two fictional consenting adults, age 25"),
    { allowed: true, reason: null },
  );
});

test("ComfyUI workflow optimization detects tiled VAE without inferring runtime offload", () => {
  const report = analyzeComfyWorkflowOptimization({
    1: { class_type: "VAEDecode", inputs: {} },
    2: { class_type: "VAE Decode (Tiled)", inputs: {} },
    3: { class_type: "VAEEncodeTiled", inputs: {} },
  });
  assert.equal(report.hasTiledVaeDecode, true);
  assert.equal(report.hasTiledVaeEncode, true);
  assert.equal(report.hasStandardVaeDecode, true);
  assert.equal(report.lowSpecVaeReady, true);
  assert.equal(report.cpuOffloadVerification, "runtime_required");
});

test("runtime profile recommendation fails closed for missing GPU details", () => {
  assert.equal(
    recommendRuntimeProfile({
      totalRamBytes: 16 * 1024 ** 3,
      gpuName: null,
      dedicatedVramMb: null,
    }),
    "cpu_only",
  );
  assert.equal(
    recommendRuntimeProfile({
      totalRamBytes: 32 * 1024 ** 3,
      gpuName: "Detected GPU",
      dedicatedVramMb: null,
    }),
    "vram_6gb",
  );
});

test("runtime profile recommendation follows VRAM tiers", () => {
  const profile = (vram) =>
    recommendRuntimeProfile({
      totalRamBytes: 32 * 1024 ** 3,
      gpuName: "GPU",
      dedicatedVramMb: vram,
    });
  assert.equal(profile(8 * 1024), "vram_8gb");
  assert.equal(profile(12 * 1024), "vram_12gb");
  assert.equal(profile(16 * 1024), "vram_16gb");
  assert.equal(profile(24 * 1024), "vram_24gb_plus");
});

test("all local runtime profiles serialize image generation", () => {
  for (const profile of [
    "cpu_only",
    "vram_6gb",
    "vram_8gb",
    "vram_12gb",
    "vram_16gb",
    "vram_24gb_plus",
  ]) {
    assert.equal(runtimeLimits(profile).batchSize, 1);
    assert.equal(runtimeLimits(profile).maxConcurrentLocalJobs, 1);
  }
});

test("low VRAM profiles require exclusive GPU work and model unload", () => {
  for (const profile of ["cpu_only", "vram_6gb", "vram_8gb", "vram_12gb"]) {
    assert.equal(runtimeLimits(profile).exclusiveGpuWork, true);
    assert.equal(runtimeLimits(profile).unloadTextModelBeforeImage, true);
  }
  assert.equal(runtimeLimits("vram_16gb").exclusiveGpuWork, false);
  assert.equal(runtimeLimits("vram_16gb").unloadTextModelBeforeImage, false);
});

test("runtime profile scales generation dimensions without changing aspect ratio", () => {
  assert.deepEqual(constrainImageDimensions(1600, 1200, 1024), {
    width: 1024,
    height: 768,
    adjusted: true,
  });
  assert.deepEqual(constrainImageDimensions(768, 1024, 1024), {
    width: 768,
    height: 1024,
    adjusted: false,
  });
});

test("night queue windows support overnight and daytime ranges", () => {
  const overnight = {
    nightModeEnabled: true,
    startTime: "22:00",
    endTime: "07:00",
  };
  assert.equal(isGenerationQueueWindowOpen(overnight, 23 * 60), true);
  assert.equal(isGenerationQueueWindowOpen(overnight, 6 * 60), true);
  assert.equal(isGenerationQueueWindowOpen(overnight, 12 * 60), false);
  assert.equal(minutesUntilGenerationQueueWindow(overnight, 12 * 60), 10 * 60);
  assert.equal(
    isGenerationQueueWindowOpen(
      { ...overnight, startTime: "09:00", endTime: "17:00" },
      12 * 60,
    ),
    true,
  );
});

function job(overrides = {}) {
  return {
    projectId,
    type: "background",
    sensitivity: "safe",
    personPresence: "none",
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    policy: "safe_assets_only",
    availableTargets: ["builtin", "local", "cloud", "asset_library"],
    preferLocal: false,
    externalProviderEnabled: true,
    externalCostWithinLimit: true,
    requireExternalConfirmation: true,
    cloudProviderId: "background-api",
    ...overrides,
  };
}

test("builtin operations never leave the application", () => {
  const result = routeGenerationJob(
    job({
      type: "speech_bubble",
      sensitivity: "adult",
      requestedTarget: "cloud",
    }),
    context(),
  );
  assert.deepEqual(result, {
    target: "builtin",
    reason: "builtin_operation",
    requiresUserConfirmation: false,
    blocked: false,
  });
});

test("adult and restricted jobs cannot be forced to cloud", () => {
  for (const sensitivity of ["adult", "restricted", "external_forbidden"]) {
    const result = routeGenerationJob(
      job({ sensitivity, requestedTarget: "cloud" }),
      context(),
    );
    assert.equal(result.target, "local");
    assert.equal(result.reason, "sensitive_local_only");
    assert.equal(result.blocked, false);
  }
});

test("missing classification fails closed", () => {
  const parsed = generationJobDraftSchema.parse({
    projectId,
    type: "background",
  });
  assert.equal(parsed.sensitivity, "external_forbidden");
  assert.equal(parsed.personPresence, "unknown");
  const result = routeGenerationJob(
    { projectId, type: "background" },
    context(),
  );
  assert.equal(result.target, "local");
  assert.equal(result.reason, "sensitive_local_only");
});

test("person, character, completed page and forbidden input assets stay local", () => {
  const cases = [
    { personPresence: "present" },
    { hasCharacterReference: true },
    { hasCompletedPage: true },
    { promptIncludesRestrictedContent: true },
    { inputAssetIds: [randomUUID()], allInputAssetsExternalAllowed: false },
  ];
  for (const value of cases) {
    const result = routeGenerationJob(job(value), context());
    assert.equal(result.target, "local");
    assert.equal(result.reason, "sensitive_local_only");
  }
});

test("local-only policy overrides a requested cloud target", () => {
  const result = routeGenerationJob(
    job({ requestedTarget: "cloud" }),
    context({ policy: "local_only" }),
  );
  assert.equal(result.target, "local");
  assert.equal(result.reason, "project_local_only");
});

test("asset library is preferred for reusable safe assets", () => {
  const result = routeGenerationJob(job(), context());
  assert.deepEqual(result, {
    target: "asset_library",
    reason: "asset_library_preferred",
    requiresUserConfirmation: false,
    blocked: false,
  });
});

test("safe background can use cloud when the asset library is unavailable", () => {
  const result = routeGenerationJob(
    job(),
    context({ availableTargets: ["local", "cloud"] }),
  );
  assert.deepEqual(result, {
    target: "cloud",
    providerId: "background-api",
    reason: "external_safe_asset_allowed",
    requiresUserConfirmation: true,
    blocked: false,
  });
});

test("project local preference wins before an available cloud provider", () => {
  const result = routeGenerationJob(
    job(),
    context({
      availableTargets: ["local", "cloud"],
      preferLocal: true,
    }),
  );
  assert.equal(result.target, "local");
  assert.equal(result.reason, "local_fallback");
});

test("background-only policy does not send props to cloud", () => {
  const result = routeGenerationJob(
    job({ type: "prop" }),
    context({
      policy: "background_only",
      availableTargets: ["local", "cloud"],
    }),
  );
  assert.equal(result.target, "local");
  assert.equal(result.reason, "local_fallback");
});

test("manual approval policy marks cloud routing for confirmation", () => {
  const result = routeGenerationJob(
    job(),
    context({
      policy: "manual_approval",
      availableTargets: ["local", "cloud"],
      requireExternalConfirmation: false,
      manualApprovalGranted: false,
    }),
  );
  assert.equal(result.target, "cloud");
  assert.equal(result.reason, "external_manual_approval");
  assert.equal(result.requiresUserConfirmation, true);
});

test("custom policy only allows configured cloud job types", () => {
  const allowed = routeGenerationJob(
    job({ type: "effect" }),
    context({
      policy: "custom",
      customCloudJobTypes: ["effect"],
      availableTargets: ["local", "cloud"],
    }),
  );
  assert.equal(allowed.target, "cloud");
  const denied = routeGenerationJob(
    job({ type: "prop" }),
    context({
      policy: "custom",
      customCloudJobTypes: ["effect"],
      availableTargets: ["local", "cloud"],
    }),
  );
  assert.equal(denied.target, "local");
});

test("sensitive jobs block when no approved execution target exists", () => {
  const result = routeGenerationJob(
    job({ sensitivity: "adult" }),
    context({ availableTargets: ["cloud"] }),
  );
  assert.deepEqual(result, {
    target: "local",
    reason: "required_target_unavailable",
    requiresUserConfirmation: false,
    blocked: true,
  });
});

test("an approved render node is an explicit sensitive fallback", () => {
  const result = routeGenerationJob(
    job({ sensitivity: "adult" }),
    context({
      availableTargets: ["cloud", "render_node"],
      sensitiveRenderNodeAllowed: true,
      renderNodeProviderId: "home-gpu",
    }),
  );
  assert.deepEqual(result, {
    target: "render_node",
    providerId: "home-gpu",
    reason: "sensitive_render_node",
    requiresUserConfirmation: true,
    blocked: false,
  });
});

test("external safe asset preview is disabled and content-minimized by default", () => {
  const preview = createExternalDispatchPreview({
    previewId: randomUUID(),
    request: {
      projectId,
      type: "background",
      query: "empty school classroom",
    },
    promptSha256: "a".repeat(64),
    policy: "safe_assets_only",
    createdAt: new Date().toISOString(),
  });
  assert.equal(preview.executable, false);
  assert.equal(preview.blockReason, "provider_not_configured");
  assert.equal(preview.requiresUserConfirmation, true);
  assert.deepEqual(preview.manifest, {
    jobType: "background",
    sensitivity: "safe",
    promptIncluded: true,
    negativePromptIncluded: false,
    inputAssetCount: 0,
    characterReferenceIncluded: false,
    completedPageIncluded: false,
    personPresence: "none",
  });
  assert.equal(JSON.stringify(preview).includes("school classroom"), false);
});

test("configured external preview still requires explicit confirmation", () => {
  const preview = createExternalDispatchPreview({
    previewId: randomUUID(),
    request: { projectId, type: "effect", query: "speed lines" },
    promptSha256: "b".repeat(64),
    policy: "safe_assets_only",
    provider: {
      providerId: "safe-assets",
      displayName: "Safe Assets",
      enabled: true,
      endpointConfigured: true,
      supportedJobTypes: ["background", "prop", "effect"],
      dataRetentionSummary: "24 hours",
      trainingUseSummary: "Not used for training",
      pricingSummary: "Per image",
    },
    estimate: { cost: 12, currency: "jpy" },
    createdAt: new Date().toISOString(),
  });
  assert.equal(preview.executable, true);
  assert.equal(preview.blockReason, null);
  assert.equal(preview.currency, "JPY");
  assert.equal(preview.requiresUserConfirmation, true);
  assert.throws(() =>
    externalDispatchConfirmationSchema.parse({
      previewId: preview.previewId,
      promptSha256: preview.promptSha256,
      payloadReviewed: true,
      costReviewed: false,
      providerTermsReviewed: true,
      confirmedAt: new Date().toISOString(),
    }),
  );
});

test("configured external preview reports a cost guard block reason", () => {
  const preview = createExternalDispatchPreview({
    previewId: randomUUID(),
    request: { projectId, type: "background", query: "empty city" },
    promptSha256: "d".repeat(64),
    policy: "safe_assets_only",
    provider: {
      providerId: "safe-assets",
      displayName: "Safe Assets",
      enabled: true,
      endpointConfigured: true,
      supportedJobTypes: ["background"],
      dataRetentionSummary: "24 hours",
      trainingUseSummary: "Not used for training",
      pricingSummary: "Per image",
    },
    estimate: { cost: 0.01, currency: "USD" },
    costBlockReason: "balance_insufficient",
    createdAt: new Date().toISOString(),
  });
  assert.equal(preview.executable, false);
  assert.equal(preview.blockReason, "balance_insufficient");
  assert.equal(preview.estimatedCost, 0.01);
});

test("external preview binds a selected model and rejects unavailable models", () => {
  const preview = createExternalDispatchPreview({
    previewId: randomUUID(),
    request: {
      projectId,
      type: "background",
      query: "empty station",
      modelId: "model-from-provider",
    },
    promptSha256: "e".repeat(64),
    policy: "safe_assets_only",
    provider: {
      providerId: "safe-assets",
      displayName: "Safe Assets",
      enabled: true,
      endpointConfigured: true,
      supportedJobTypes: ["background"],
      dataRetentionSummary: "24 hours",
      trainingUseSummary: "Unknown",
      pricingSummary: "Per image",
    },
    modelName: "Model from provider",
    requestBlockReason: "model_unavailable",
    estimate: { cost: 0.01, currency: "USD" },
    createdAt: new Date().toISOString(),
  });
  assert.equal(preview.modelId, "model-from-provider");
  assert.equal(preview.modelName, "Model from provider");
  assert.equal(preview.executable, false);
  assert.equal(preview.blockReason, "model_unavailable");
});

test("project policy blocks an otherwise configured external preview", () => {
  const preview = createExternalDispatchPreview({
    previewId: randomUUID(),
    request: { projectId, type: "prop", query: "desk" },
    promptSha256: "c".repeat(64),
    policy: "background_only",
    provider: {
      providerId: "safe-assets",
      displayName: "Safe Assets",
      enabled: true,
      endpointConfigured: true,
      supportedJobTypes: ["prop"],
      dataRetentionSummary: "24 hours",
      trainingUseSummary: "Not used for training",
      pricingSummary: "Per image",
    },
    estimate: { cost: 12, currency: "JPY" },
    createdAt: new Date().toISOString(),
  });
  assert.equal(preview.executable, false);
  assert.equal(preview.blockReason, "policy_blocked");
});
