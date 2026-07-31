import { pathToFileURL } from "node:url";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLOUD_ADULT_MONITOR_BETA_ENABLED",
  "CLOUD_ADULT_RESEARCH_ENABLED",
  "CLOUD_ADULT_AI_PLANNING_ENABLED",
  "CLOUD_ADULT_SCENARIO_GENERATION_ENABLED",
  "CLOUD_ADULT_STORYBOARD_GENERATION_ENABLED",
  "CLOUD_ADULT_CANVAS_ENABLED",
  "CLOUD_ADULT_WORK_MANAGEMENT_ENABLED",
];

export function checkCloudAdultMonitorBetaEnvironment(env = process.env) {
  const checks = required.map((key) => ({
    key,
    configured: Boolean(env[key]?.trim()),
    enabled:
      key.startsWith("CLOUD_") && key.endsWith("_ENABLED")
        ? env[key]?.trim().toLowerCase() === "true"
        : undefined,
  }));
  return {
    passed: checks.every(
      (check) => check.configured && check.enabled !== false,
    ),
    checks,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkCloudAdultMonitorBetaEnvironment();
  for (const check of report.checks)
    console.log(
      `${check.configured && check.enabled !== false ? "OK" : "MISSING"} ${check.key}`,
    );
  console.log("INFO Values and credentials are never printed.");
  console.log("INFO Adult image generation, public sharing and sales remain disabled.");
  if (!report.passed) process.exitCode = 1;
}
