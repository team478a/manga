import { pathToFileURL } from "node:url";

const CONTINUE_STATUSES = new Set(["segment_completed", "completed"]);
const STOP_STATUSES = new Set(["idle", "failed"]);
const WORKER_PATH = "/api/internal/cloud-export/worker";

function integerInRange(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export function readCloudExportSchedulerConfig(env = process.env) {
  const enabled = env.MANGAI_CLOUD_EXPORT_SCHEDULER_ENABLED === "true";
  if (!enabled) return { enabled: false };

  const secret = env.MANGAI_CLOUD_EXPORT_WORKER_SECRET?.trim();
  if (!secret || secret.length < 32)
    throw new Error("Export Worker認証設定が不足しています。");

  let endpoint;
  try {
    endpoint = new URL(env.MANGAI_CLOUD_EXPORT_WORKER_URL ?? "");
  } catch {
    throw new Error("Export Worker URL設定が不正です。");
  }
  const localHttp =
    endpoint.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !localHttp)
    throw new Error("Export Worker URLはHTTPSで設定してください。");
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.hash ||
    endpoint.search ||
    endpoint.pathname.replace(/\/+$/, "") !== WORKER_PATH
  )
    throw new Error("Export Worker URL設定が不正です。");

  return {
    enabled: true,
    endpoint: endpoint.toString(),
    secret,
    maxSegments: integerInRange(
      env.MANGAI_CLOUD_EXPORT_SCHEDULER_MAX_SEGMENTS,
      3,
      1,
      3,
    ),
    timeoutMs:
      integerInRange(
        env.MANGAI_CLOUD_EXPORT_SCHEDULER_TIMEOUT_SECONDS,
        285,
        30,
        285,
      ) * 1000,
  };
}

export async function runCloudExportWorkerScheduler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const config = readCloudExportSchedulerConfig(env);
  if (!config.enabled) {
    logger.log("Cloud export scheduler is disabled; no request was sent.");
    return {
      enabled: false,
      requests: 0,
      processedSegments: 0,
      finalStatus: "disabled",
    };
  }

  let processedSegments = 0;
  let finalStatus = "limit_reached";
  for (let requests = 1; requests <= config.maxSegments; requests += 1) {
    let response;
    try {
      response = await fetchImpl(config.endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${config.secret}` },
        cache: "no-store",
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch {
      throw new Error("Export Workerへ接続できませんでした。");
    }
    if (!response.ok)
      throw new Error(
        `Export Workerが安全に停止しました (HTTP ${response.status})。`,
      );

    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("Export Worker応答を確認できませんでした。");
    }
    const status = typeof body?.status === "string" ? body.status : "unknown";
    if (!CONTINUE_STATUSES.has(status) && !STOP_STATUSES.has(status))
      throw new Error("Export Worker応答の状態を確認できませんでした。");

    finalStatus = status;
    if (CONTINUE_STATUSES.has(status)) processedSegments += 1;
    if (STOP_STATUSES.has(status))
      return { enabled: true, requests, processedSegments, finalStatus };
  }

  return {
    enabled: true,
    requests: config.maxSegments,
    processedSegments,
    finalStatus,
  };
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const config = readCloudExportSchedulerConfig();
  if (checkOnly) {
    console.log(`${config.enabled ? "READY" : "DISABLED"} Cloud export scheduler`);
    console.log("INFO Credentials and values are never printed.");
    return;
  }
  const result = await runCloudExportWorkerScheduler();
  console.log(
    `Cloud export scheduler finished: status=${result.finalStatus} requests=${result.requests} processed_segments=${result.processedSegments}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Scheduler failed safely.");
    process.exitCode = 1;
  });
