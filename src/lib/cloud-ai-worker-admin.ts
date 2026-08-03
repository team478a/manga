export type CloudAiWorkerEnvironment = Record<string, string | undefined>;

export function getCloudAiWorkerConfiguration(
  env: CloudAiWorkerEnvironment = process.env,
) {
  const enabled = env.MANGAI_CLOUD_AI_WORKER_ENABLED === "true";
  const secretReady = Boolean(
    env.MANGAI_CLOUD_AI_WORKER_SECRET &&
      env.MANGAI_CLOUD_AI_WORKER_SECRET.length >= 32,
  );
  return { enabled, secretReady, ready: enabled && secretReady };
}

export function getCloudAiWorkerInvocationUrl(
  env: CloudAiWorkerEnvironment = process.env,
) {
  const baseUrl = env.VERCEL_URL
    ? `https://${env.VERCEL_URL}`
    : env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl) return null;
  try {
    const parsed = new URL(baseUrl);
    if (
      parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && parsed.hostname === "localhost")
    )
      return null;
    return new URL("/api/internal/cloud-ai/worker", parsed.origin).toString();
  } catch {
    return null;
  }
}
