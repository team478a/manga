import { pathToFileURL } from "node:url";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MONITOR_INVITE_SITE_URL",
  "CLOUD_GENERAL_MONITOR_BETA_ENABLED",
  "CLOUD_RESEARCH_MVP_ENABLED",
  "CLOUD_PROPOSAL_GENERATION_ENABLED",
  "CLOUD_SCENARIO_GENERATION_ENABLED",
  "CLOUD_STORYBOARD_GENERATION_ENABLED",
  "CLOUD_STORYBOARD_CANVAS_ENABLED",
  "CLOUD_PANEL_IMAGE_GENERATION_ENABLED",
];

const mustRemainDisabled = [
  "CLOUD_ADULT_RESEARCH_ENABLED",
  "CLOUD_ADULT_PLANNING_ENABLED",
];

export function checkCloudGeneralMonitorBetaEnvironment(env = process.env) {
  const checks = required.map((key) => ({
    key,
    configured: Boolean(env[key]?.trim()),
    enabled:
      key.startsWith("CLOUD_") && key.endsWith("_ENABLED")
        ? env[key]?.trim().toLowerCase() === "true"
        : undefined,
  }));
  const exclusions = mustRemainDisabled.map((key) => ({
    key,
    disabled: env[key]?.trim().toLowerCase() !== "true",
  }));
  return {
    passed:
      checks.every((check) => check.configured && check.enabled !== false) &&
      exclusions.every((check) => check.disabled),
    checks,
    exclusions,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkCloudGeneralMonitorBetaEnvironment();
  for (const check of report.checks)
    console.log(`${check.configured && check.enabled !== false ? "OK" : "MISSING"} ${check.key}`);
  for (const check of report.exclusions)
    console.log(`${check.disabled ? "OK_DISABLED" : "MUST_DISABLE"} ${check.key}`);
  console.log("INFO Values and credentials are never printed.");
  console.log("INFO Stripe, sales and adult features are outside this monitor.");
  if (!report.passed) process.exitCode = 1;
}
