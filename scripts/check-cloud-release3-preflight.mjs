import { pathToFileURL } from "node:url";
import { checkCloudRelease2Environment } from "./check-cloud-release2-preflight.mjs";

const PASS = "PASS";
const FAIL = "FAIL";
const INFO = "INFO";
const enabled = (value) => String(value ?? "").trim().toLowerCase() === "true";

export function checkCloudRelease3Environment(env = process.env) {
  const release2 = checkCloudRelease2Environment(env);
  const scenarioEnabled = enabled(env.CLOUD_SCENARIO_GENERATION_ENABLED);
  const checks = [
    ...release2.checks,
    {
      name: "CLOUD_SCENARIO_GENERATION_ENABLED",
      status: scenarioEnabled ? PASS : FAIL,
      message: scenarioEnabled ? "限定公開対象で有効です。" : "Release 3限定公開時はtrueが必要です。",
    },
    {
      name: "OPENAI_RUNTIME_CONFIG",
      status: INFO,
      message: "APIキーとmodelは管理画面とSupabase Vaultで確認してください。秘密値は出力しません。",
    },
    {
      name: "CLOUD_STORY_SCENARIO_MIGRATION",
      status: INFO,
      message: "202607300003_cloud_story_scenarios.sqlの適用状態を対象DBで確認してください。",
    },
  ];
  return {
    passed: release2.passed && scenarioEnabled && checks.every((check) => check.status !== FAIL),
    checks,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkCloudRelease3Environment();
  for (const check of report.checks)
    console.log(`${check.status.padEnd(4)} ${check.name}: ${check.message}`);
  console.log(report.passed ? "Release 3 environment preflight: PASS" : "Release 3 environment preflight: FAIL");
  if (!report.passed) process.exitCode = 1;
}
