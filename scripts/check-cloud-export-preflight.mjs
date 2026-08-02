import { pathToFileURL } from "node:url";

const PASS = "PASS";
const FAIL = "FAIL";
const INFO = "INFO";

export function checkCloudExportEnvironment(env = process.env) {
  const enabled = String(env.MANGAI_CLOUD_EXPORT_WORKER_ENABLED ?? "")
    .trim()
    .toLowerCase() === "true";
  const secretReady = String(env.MANGAI_CLOUD_EXPORT_WORKER_SECRET ?? "").length >= 32;
  const serviceRoleReady = String(env.SUPABASE_SERVICE_ROLE_KEY ?? "").length >= 20;
  const supabaseUrlReady = /^https:\/\/.+/.test(String(env.NEXT_PUBLIC_SUPABASE_URL ?? ""));
  const workerIdReady = String(env.MANGAI_CLOUD_EXPORT_WORKER_ID ?? "").trim().length > 0;
  const checks = [
    { name: "MANGAI_CLOUD_EXPORT_WORKER_ENABLED", status: enabled ? PASS : FAIL, message: enabled ? "有効です。" : "Worker起動前にtrueが必要です。" },
    { name: "MANGAI_CLOUD_EXPORT_WORKER_SECRET", status: secretReady ? PASS : FAIL, message: secretReady ? "32文字以上の値が設定されています。" : "32文字以上の秘密値が必要です。" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", status: serviceRoleReady ? PASS : FAIL, message: serviceRoleReady ? "設定されています。" : "Worker用のService Role Keyが必要です。" },
    { name: "NEXT_PUBLIC_SUPABASE_URL", status: supabaseUrlReady ? PASS : FAIL, message: supabaseUrlReady ? "HTTPS URLが設定されています。" : "Supabase HTTPS URLが必要です。" },
    { name: "MANGAI_CLOUD_EXPORT_WORKER_ID", status: workerIdReady ? PASS : INFO, message: workerIdReady ? "設定されています。" : "未設定時は既定のworker IDを使用します。" },
  ];
  return { passed: checks.every((check) => check.status !== FAIL), checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkCloudExportEnvironment();
  for (const check of report.checks) console.log(`${check.status.padEnd(4)} ${check.name}: ${check.message}`);
  console.log(report.passed ? "Cloud export environment preflight: PASS" : "Cloud export environment preflight: FAIL");
  if (!report.passed) process.exitCode = 1;
}
