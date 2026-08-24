import assert from "node:assert/strict";
import test from "node:test";
import {
  adminAccessRedirect,
  profileAccessRedirect,
  profileOwnsResource,
} from "../src/lib/access-guards.ts";
import {
  featureFlagDefinitions,
  featureFlagEnabled,
} from "../src/lib/feature-flags.ts";

test("Feature Flag registryは監査済み23件を保持する", () => {
  assert.equal(Object.keys(featureFlagDefinitions).length, 23);
  assert.equal(
    featureFlagDefinitions.CLOUD_PANEL_INPAINTING_ENABLED,
    "strict",
  );
  assert.equal(
    featureFlagDefinitions.CLOUD_PANEL_OUTPAINTING_ENABLED,
    "strict",
  );
  assert.equal(
    featureFlagDefinitions.CLOUD_GENERATION_RESUMABLE_V2_ENABLED,
    "strict",
  );
});

test("既存のcase-insensitive Flag解釈を維持する", () => {
  for (const value of ["true", "TRUE", "True"]) {
    assert.equal(
      featureFlagEnabled("CLOUD_RESEARCH_MVP_ENABLED", {
        CLOUD_RESEARCH_MVP_ENABLED: value,
      }),
      true,
    );
  }
  for (const value of [undefined, "false", "1", " true "]) {
    assert.equal(
      featureFlagEnabled("CLOUD_RESEARCH_MVP_ENABLED", {
        CLOUD_RESEARCH_MVP_ENABLED: value,
      }),
      false,
    );
  }
});

test("Provider／Workerと画像編集Flagは小文字trueだけを許可する", () => {
  const strictFlags = [
    "CLOUD_GENERATION_RESUMABLE_V2_ENABLED",
    "CLOUD_PANEL_INPAINTING_ENABLED",
    "CLOUD_PANEL_OUTPAINTING_ENABLED",
    "MANGAI_CLOUD_AI_WORKER_ENABLED",
    "MANGAI_CLOUD_EXPORT_WORKER_ENABLED",
    "MANGAI_CLOUD_STORAGE_WORKER_ENABLED",
    "MANGAI_MONITOR_OPS_WORKER_ENABLED",
    "MANGAI_MONITOR_QUALITY_REVIEW_ENABLED",
  ];
  for (const flag of strictFlags) {
    assert.equal(featureFlagEnabled(flag, { [flag]: "true" }), true);
    for (const value of [undefined, "TRUE", "True", "1", " true "]) {
      assert.equal(featureFlagEnabled(flag, { [flag]: value }), false);
    }
  }
});

test("profileとadmin guardは既存redirectを維持する", () => {
  const profile = { role: "user" };
  assert.equal(profileAccessRedirect(false, null), "/login");
  assert.equal(profileAccessRedirect(true, null), "/signup?message=profile");
  assert.equal(profileAccessRedirect(true, profile), null);
  assert.equal(adminAccessRedirect(profile), "/dashboard");
  assert.equal(adminAccessRedirect({ role: "admin" }), null);
});

test("owner判定は認証profile IDとの完全一致だけを許可する", () => {
  assert.equal(profileOwnsResource("profile-a", "profile-a"), true);
  assert.equal(profileOwnsResource("profile-a", "profile-b"), false);
  assert.equal(profileOwnsResource("profile-a", "PROFILE-A"), false);
});

