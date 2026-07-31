import { pathToFileURL } from "node:url";
import { checkCloudRelease3Environment } from "./check-cloud-release3-preflight.mjs";
const PASS = "PASS", FAIL = "FAIL", INFO = "INFO";
export function checkCloudRelease4Environment(env = process.env) {
  const release3 = checkCloudRelease3Environment(env);
  const enabled = String(env.CLOUD_STORYBOARD_GENERATION_ENABLED ?? "").trim().toLowerCase() === "true";
  const checks = [...release3.checks, {
    name: "CLOUD_STORYBOARD_GENERATION_ENABLED", status: enabled ? PASS : FAIL,
    message: enabled ? "限定公開対象で有効です。" : "Release 4限定公開時はtrueが必要です。",
  }, {
    name: "CLOUD_STORY_STORYBOARD_MIGRATION", status: INFO,
    message: "202607300004_cloud_story_storyboards.sqlの適用状態を対象DBで確認してください。",
  }];
  return { passed: release3.passed && enabled && checks.every((check) => check.status !== FAIL), checks };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkCloudRelease4Environment();
  for (const check of report.checks) console.log(`${check.status.padEnd(4)} ${check.name}: ${check.message}`);
  console.log(report.passed ? "Release 4 environment preflight: PASS" : "Release 4 environment preflight: FAIL");
  if (!report.passed) process.exitCode = 1;
}
