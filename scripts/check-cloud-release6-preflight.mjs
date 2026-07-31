import { pathToFileURL } from "node:url";
import { checkCloudRelease5Environment } from "./check-cloud-release5-preflight.mjs";

const PASS = "PASS", FAIL = "FAIL", INFO = "INFO";
export function checkCloudRelease6Environment(env = process.env) {
  const release5 = checkCloudRelease5Environment(env);
  const enabled =
    String(env.CLOUD_PANEL_IMAGE_GENERATION_ENABLED ?? "")
      .trim()
      .toLowerCase() === "true";
  const checks = [
    ...release5.checks,
    {
      name: "CLOUD_PANEL_IMAGE_GENERATION_ENABLED",
      status: enabled ? PASS : FAIL,
      message: enabled
        ? "限定公開対象で有効です。"
        : "Release 6限定公開時はtrueが必要です。",
    },
    {
      name: "CLOUD_IMAGE_PROVIDER",
      status: INFO,
      message:
        "Provider、pricing、Worker、quotaは既存Cloud AI preflightで別途確認してください。",
    },
  ];
  return {
    passed:
      release5.passed &&
      enabled &&
      checks.every((check) => check.status !== FAIL),
    checks,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkCloudRelease6Environment();
  for (const check of report.checks)
    console.log(`${check.status.padEnd(4)} ${check.name}: ${check.message}`);
  console.log(
    report.passed
      ? "Release 6 environment preflight: PASS"
      : "Release 6 environment preflight: FAIL",
  );
  if (!report.passed) process.exitCode = 1;
}
