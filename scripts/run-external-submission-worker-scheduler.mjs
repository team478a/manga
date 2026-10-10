import { pathToFileURL } from "node:url";

const KNOWN_STATUSES = new Set(["idle", "completed", "failed"]);
const WORKER_PATH = "/api/internal/external-submissions/worker";

function integerInRange(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export function readExternalSubmissionSchedulerConfig(env = process.env) {
  const enabled = env.MANGAI_EXTERNAL_SUBMISSION_SCHEDULER_ENABLED === "true";
  if (!enabled) return { enabled: false };

  const secret = env.MANGAI_EXTERNAL_SUBMISSION_WORKER_SECRET?.trim();
  if (!secret || secret.length < 32)
    throw new Error("External submission Worker認証設定が不足しています。");

  let endpoint;
  try {
    endpoint = new URL(env.MANGAI_EXTERNAL_SUBMISSION_WORKER_URL ?? "");
  } catch {
    throw new Error("External submission Worker URL設定が不正です。");
  }
  const localHttp =
    endpoint.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !localHttp)
    throw new Error("External submission Worker URLはHTTPSで設定してください。");
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.hash ||
    endpoint.search ||
    endpoint.pathname.replace(/\/+$/, "") !== WORKER_PATH
  )
    throw new Error("External submission Worker URL設定が不正です。");

  return {
    enabled: true,
    endpoint: endpoint.toString(),
    secret,
    timeoutMs:
      integerInRange(
        env.MANGAI_EXTERNAL_SUBMISSION_SCHEDULER_TIMEOUT_SECONDS,
        285,
        30,
        285,
      ) * 1000,
  };
}

export async function runExternalSubmissionWorkerScheduler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const config = readExternalSubmissionSchedulerConfig(env);
  if (!config.enabled) {
    logger.log("External submission scheduler is disabled; no request was sent.");
    return { enabled: false, requests: 0, processed: 0, finalStatus: "disabled" };
  }

  let response;
  try {
    response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${config.secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch {
    throw new Error("External submission Workerへ接続できませんでした。");
  }
  if (!response.ok)
    throw new Error(
      `External submission Workerが安全に停止しました (HTTP ${response.status})。`,
    );

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("External submission Worker応答を確認できませんでした。");
  }
  const status = typeof body?.status === "string" ? body.status : "unknown";
  if (!KNOWN_STATUSES.has(status))
    throw new Error("External submission Worker応答の状態を確認できませんでした。");

  return {
    enabled: true,
    requests: 1,
    processed: status === "idle" ? 0 : 1,
    finalStatus: status,
  };
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const config = readExternalSubmissionSchedulerConfig();
  if (checkOnly) {
    console.log(
      `${config.enabled ? "READY" : "DISABLED"} External submission scheduler`,
    );
    console.log("INFO Credentials and values are never printed.");
    return;
  }
  const result = await runExternalSubmissionWorkerScheduler();
  console.log(
    `External submission scheduler finished: status=${result.finalStatus} requests=${result.requests} processed=${result.processed}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Scheduler failed safely.");
    process.exitCode = 1;
  });
