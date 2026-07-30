import assert from "node:assert/strict";
import test from "node:test";
import { checkCloudRelease6Environment } from "../scripts/check-cloud-release6-preflight.mjs";

const valid = {
  CLOUD_RESEARCH_MVP_ENABLED: "true",
  CLOUD_PROPOSAL_GENERATION_ENABLED: "true",
  CLOUD_SCENARIO_GENERATION_ENABLED: "true",
  CLOUD_STORYBOARD_GENERATION_ENABLED: "true",
  CLOUD_STORYBOARD_CANVAS_ENABLED: "true",
  CLOUD_PANEL_IMAGE_GENERATION_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://mangai-test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
  NEXT_PUBLIC_SITE_URL: "https://mangai-preview.vercel.app",
  SUPABASE_SERVICE_ROLE_KEY: "b".repeat(40),
  CLOUD_AI_RATE_LIMIT_SECRET: "c".repeat(32),
};

test("Release 6 preflightはpanel image flag未設定時fail closedする", () => {
  assert.equal(
    checkCloudRelease6Environment({
      ...valid,
      CLOUD_PANEL_IMAGE_GENERATION_ENABLED: undefined,
    }).passed,
    false,
  );
  assert.equal(checkCloudRelease6Environment(valid).passed, true);
});
