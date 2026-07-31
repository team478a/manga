import assert from "node:assert/strict";
import test from "node:test";
import { checkCloudRelease4Environment } from "../scripts/check-cloud-release4-preflight.mjs";
const valid = {
  CLOUD_RESEARCH_MVP_ENABLED: "true", CLOUD_PROPOSAL_GENERATION_ENABLED: "true",
  CLOUD_SCENARIO_GENERATION_ENABLED: "true", CLOUD_STORYBOARD_GENERATION_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://mangai-test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
  NEXT_PUBLIC_SITE_URL: "https://mangai-preview.vercel.app",
  SUPABASE_SERVICE_ROLE_KEY: "b".repeat(40), CLOUD_AI_RATE_LIMIT_SECRET: "c".repeat(32),
};
test("Release 4 preflightはstoryboard flag未設定時fail closedする", () => {
  assert.equal(checkCloudRelease4Environment({ ...valid, CLOUD_STORYBOARD_GENERATION_ENABLED: undefined }).passed, false);
  assert.equal(checkCloudRelease4Environment(valid).passed, true);
});
