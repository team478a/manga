import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPLETION_MODE_PROFILE_VERSION,
  completionModeProfileSchema,
  resolveCompletionModeProfile,
} from "../packages/shared/src/index.ts";

const profile = (overrides = {}) => ({
  version: COMPLETION_MODE_PROFILE_VERSION,
  mode: "longform_story",
  executionSurface: "cloud_general",
  pagePreset: { width: 1600, height: 2400, dpi: 300, readingDirection: "rtl" },
  guidance: { panelsPerPage: { min: 1, max: 8 }, maxDialogueGraphemesPerPanel: 200 },
  requiredChecks: ["manuscript_preflight", "quality_findings", "content_boundary"],
  allowedExports: ["png", "jpeg", "pdf", "project_json"],
  ...overrides,
});

test("P4-A完成profileは3 modeとversion付き追跡値を検証する", () => {
  for (const value of [
    profile(),
    profile({ mode: "kindle_explainer", executionSurface: "desktop_local" }),
    profile({ mode: "adult_local", executionSurface: "desktop_local" }),
  ]) {
    const parsed = completionModeProfileSchema.parse(value);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.allowedExports.length, 4);
  }
});

test("成人向け完成profileはCloud surfaceをfail closedにする", () => {
  assert.equal(
    completionModeProfileSchema.safeParse(
      profile({ mode: "adult_local", executionSurface: "cloud_general" }),
    ).success,
    false,
  );
});

test("完成profileは逆転した推奨コマ数と重複した検査・出力を拒否する", () => {
  assert.equal(
    completionModeProfileSchema.safeParse(
      profile({
        guidance: { panelsPerPage: { min: 9, max: 2 }, maxDialogueGraphemesPerPanel: 200 },
        requiredChecks: ["manuscript_preflight", "manuscript_preflight"],
        allowedExports: ["pdf", "pdf"],
      }),
    ).success,
    false,
  );
  assert.equal(
    completionModeProfileSchema.safeParse(
      profile({ requiredChecks: ["manuscript_preflight"] }),
    ).success,
    false,
  );
});

test("mode未設定の既存Projectはpresetを推測せず従来動作へ戻す", () => {
  assert.equal(resolveCompletionModeProfile(undefined), null);
  assert.equal(resolveCompletionModeProfile(null), null);
  assert.deepEqual(resolveCompletionModeProfile(profile()), profile());
});
