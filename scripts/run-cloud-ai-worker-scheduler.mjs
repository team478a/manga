import { pathToFileURL } from "node:url";

const CONTINUE_STATUSES = new Set(["completed", "failed", "canceled", "resolved"]);
const STOP_STATUSES = new Set(["idle", "retrying", "lease_lost"]);

function integerInRange(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export function readCloudAiSchedulerConfig(env = process.env) {
  const enabled = env.MANGAI_CLOUD_AI_SCHEDULER_ENABLED === "true";
  if (!enabled) return { enabled: false };

  const secret = env.MANGAI_CLOUD_AI_WORKER_SECRET?.trim();
  if (!secret || secret.length < 32)
    throw new Error("Worker認証設定が不足しています。");

  let endpoint;
  try {
    endpoint = new URL(env.MANGAI_CLOUD_AI_WORKER_URL ?? "");
  } catch {
    throw new Error("Worker URL設定が不正です。");
  }
  const localHttp =
    endpoint.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !localHttp)
    throw new Error("Worker URLはHTTPSで設定してください。");
  if (endpoint.username || endpoint.password || endpoint.hash)
    throw new Error("Worker URL設定が不正です。");

  return {
    enabled: true,
    endpoint: endpoint.toString(),
    secret,
    maxJobs: integerInRange(
      env.MANGAI_CLOUD_AI_SCHEDULER_MAX_JOBS,
      3,
      1,
      3,
    ),
    timeoutMs: integerInRange(
      env.MANGAI_CLOUD_AI_SCHEDULER_TIMEOUT_SECONDS,
      230,
      30,
      235,
    ) * 1000,
  };
}

export async function runCloudAiWorkerScheduler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const config = readCloudAiSchedulerConfig(env);
  if (!config.enabled) {
    logger.log("Cloud AI scheduler is disabled; no request was sent.");
    return { enabled: false, requests: 0, processed: 0, finalStatus: "disabled" };
  }

  let processed = 0;
  let finalStatus = "limit_reached";
  for (let requests = 1; requests <= config.maxJobs; requests += 1) {
    let response;
    try {
      response = await fetchImpl(config.endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${config.secret}` },
        cache: "no-store",
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch {
      throw new Error("Workerへ接続できませんでした。");
    }
    if (!response.ok)
      throw new Error(`Workerが安全に停止しました (HTTP ${response.status})。`);

    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("Worker応答を確認できませんでした。");
    }
    const status = typeof body?.status === "string" ? body.status : "unknown";
    if (!CONTINUE_STATUSES.has(status) && !STOP_STATUSES.has(status))
      throw new Error("Worker応答の状態を確認できませんでした。");

    finalStatus = status;
    if (status !== "idle") processed += 1;
    if (STOP_STATUSES.has(status))
      return { enabled: true, requests, processed, finalStatus };
  }
  return {
    enabled: true,
    requests: config.maxJobs,
    processed,
    finalStatus,
  };
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const config = readCloudAiSchedulerConfig();
  if (checkOnly) {
    console.log(`${config.enabled ? "READY" : "DISABLED"} Cloud AI scheduler`);
    console.log("INFO Credentials and values are never printed.");
    return;
  }
  const result = await runCloudAiWorkerScheduler();
  console.log(
    `Cloud AI scheduler finished: status=${result.finalStatus} requests=${result.requests} processed=${result.processed}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Scheduler failed safely.");
    process.exitCode = 1;
  });
