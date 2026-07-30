import { pathToFileURL } from "node:url";
import { checkCloudRelease4Environment } from "./check-cloud-release4-preflight.mjs";

const PASS = "PASS", FAIL = "FAIL", INFO = "INFO";
export function checkCloudRelease5Environment(env = process.env) {
  const release4 = checkCloudRelease4Environment(env);
  const enabled = String(env.CLOUD_STORYBOARD_CANVAS_ENABLED ?? "").trim().toLowerCase() === "true";
  const checks = [...release4.checks, {
    name: "CLOUD_STORYBOARD_CANVAS_ENABLED",
    status: enabled ? PASS : FAIL,
    message: enabled ? "限定公開対象で有効です。" : "Release 5限定公開時はtrueが必要です。",
  }, {
    name: "CLOUD_STORYBOARD_CANVAS_MIGRATION",
    status: INFO,
    message: "202607300005_cloud_storyboard_canvas_materialization.sqlの適用状態を対象DBで確認してください。",
  }];
  return {
    passed: release4.passed && enabled && checks.every((check) => check.status !== FAIL),
    checks,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkCloudRelease5Environment();
  for (const check of report.checks)
    console.log(`${check.status.padEnd(4)} ${check.name}: ${check.message}`);
  console.log(report.passed ? "Release 5 environment preflight: PASS" : "Release 5 environment preflight: FAIL");
  if (!report.passed) process.exitCode = 1;
}
