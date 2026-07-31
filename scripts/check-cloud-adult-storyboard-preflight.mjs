import { pathToFileURL } from "node:url";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLOUD_RESEARCH_MVP_ENABLED",
  "CLOUD_PROPOSAL_GENERATION_ENABLED",
  "CLOUD_SCENARIO_GENERATION_ENABLED",
  "CLOUD_STORYBOARD_GENERATION_ENABLED",
  "CLOUD_ADULT_RESEARCH_ENABLED",
  "CLOUD_ADULT_AI_PLANNING_ENABLED",
  "CLOUD_ADULT_SCENARIO_GENERATION_ENABLED",
  "CLOUD_ADULT_STORYBOARD_GENERATION_ENABLED",
];

export function checkCloudAdultStoryboardEnvironment(env = process.env) {
  const checks = required.map((key) => ({ key, configured: Boolean(env[key]?.trim()) }));
  return { passed: checks.every((check) => check.configured), checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkCloudAdultStoryboardEnvironment();
  for (const check of report.checks)
    console.log(`${check.configured ? "OK" : "MISSING"} ${check.key}`);
  console.log("INFO OpenAI API key is managed by the existing Supabase Vault admin setting.");
  if (!report.passed) process.exitCode = 1;
}
