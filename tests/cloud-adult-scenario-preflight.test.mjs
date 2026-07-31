import assert from "node:assert/strict";
import test from "node:test";
import { checkCloudAdultScenarioEnvironment } from "../scripts/check-cloud-adult-scenario-preflight.mjs";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "present",
  SUPABASE_SERVICE_ROLE_KEY: "present",
  CLOUD_RESEARCH_MVP_ENABLED: "true",
  CLOUD_PROPOSAL_GENERATION_ENABLED: "true",
  CLOUD_SCENARIO_GENERATION_ENABLED: "true",
  CLOUD_ADULT_RESEARCH_ENABLED: "true",
  CLOUD_ADULT_AI_PLANNING_ENABLED: "true",
  CLOUD_ADULT_SCENARIO_GENERATION_ENABLED: "true",
};

test("成人向けAIシナリオpreflightは専用Flag未設定時fail closedする", () => {
  const env = { ...valid };
  delete env.CLOUD_ADULT_SCENARIO_GENERATION_ENABLED;
  assert.equal(checkCloudAdultScenarioEnvironment(env).passed, false);
});

test("成人向けAIシナリオpreflightは秘密値を返さず設定有無だけを確認する", () => {
  const result = checkCloudAdultScenarioEnvironment(valid);
  assert.equal(result.passed, true);
  assert.ok(result.checks.every((check) => Object.keys(check).sort().join(",") === "configured,key"));
});
