import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { generationJobDraftSchema, routeGenerationJob } from "../dist/index.js";

const projectId = randomUUID();

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
