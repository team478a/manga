function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function checkCloudStorageEnvironment(env = process.env) {
  const enabled = env.MANGAI_CLOUD_STORAGE_WORKER_ENABLED === "true";
  const checks = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", passed: present(env.NEXT_PUBLIC_SUPABASE_URL) },
    { key: "SUPABASE_SERVICE_ROLE_KEY", passed: present(env.SUPABASE_SERVICE_ROLE_KEY) },
    {
      key: "MANGAI_CLOUD_STORAGE_WORKER_SECRET",
      passed:
        !enabled ||
        (present(env.MANGAI_CLOUD_STORAGE_WORKER_SECRET) &&
          env.MANGAI_CLOUD_STORAGE_WORKER_SECRET.length >= 32),
    },
  ];
  return {
    enabled,
    passed: checks.every((check) => check.passed),
    checks,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkCloudStorageEnvironment();
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
import { pathToFileURL } from "node:url";
