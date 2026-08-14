import { NextResponse } from "next/server";
import {
  processNextCloudGenerationJob,
  processPendingCloudDialoguePlacement,
  processPendingCloudPanelAdoption,
  processPendingCloudStorageCleanup,
} from "@/modules/cloud-ai/application/process-generation";
import {
  createConfiguredCloudProviders,
  configuredRuntimeCapabilities,
} from "@/modules/cloud-ai/infrastructure/provider-registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { toApiError } from "@/lib/api-errors";
import {
  AuthenticationRequiredError,
  ProviderUnavailableError,
} from "@/lib/domain-errors";
import {
  attachHubRequestId,
  createHubRequestContext,
  logHubError,
  logHubEvent,
} from "@/lib/hub-logger";
import { featureFlagEnabled } from "@/lib/feature-flags";
import { hasValidInternalWorkerAuthorization } from "@/lib/internal-worker-auth";
import { dispatchNextCloudGenerationBatchTarget } from "@/modules/cloud-ai/application/dispatch-generation-batch";

export const runtime = "nodejs";
// Provider polling is bounded at 210 seconds. Keep enough time for lease checks,
// persistence, compensation, and notification refreshes to complete safely.
export const maxDuration = 240;

function authorized(request: Request) {
  return hasValidInternalWorkerAuthorization(
    request,
    process.env.MANGAI_CLOUD_AI_WORKER_SECRET,
  );
}

function workerLeaseSeconds() {
  const value = Number(process.env.MANGAI_CLOUD_AI_WORKER_LEASE_SECONDS ?? 300);
  return Number.isInteger(value) && value >= 150 && value <= 900 ? value : 300;
}

function workerHeartbeatIntervalMs() {
  const value = Number(
    process.env.MANGAI_CLOUD_AI_WORKER_HEARTBEAT_SECONDS ?? 60,
  );
  return Number.isInteger(value) && value >= 30 && value <= 120
    ? value * 1000
    : 60_000;
}

export async function GET(request: Request) {
  const logContext = createHubRequestContext(request);
  if (!authorized(request)) {
    logHubEvent("warn", "cloud_ai_worker_status_unauthorized", logContext);
    const response = toApiError(
      new AuthenticationRequiredError("認証できません。"),
      "認証できません。",
    );
    return attachHubRequestId(
      NextResponse.json(response.body, { status: response.status }),
      logContext,
    );
  }
  try {
    const client = createAdminClient();
    await client.rpc("refresh_cloud_ai_notifications");
    const now = new Date().toISOString();
    const [queued, running, failed, stale] = await Promise.all([
      client
        .from("cloud_generation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "queued"),
      client
        .from("cloud_generation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "running"),
      client
        .from("cloud_generation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      client
        .from("cloud_generation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "running")
        .lt("lease_expires_at", now),
    ]);
    const databaseError = [queued, running, failed, stale].find(
      (result) => result.error,
    )?.error;
    if (databaseError) throw databaseError;
    const body = {
      enabled: featureFlagEnabled("MANGAI_CLOUD_AI_WORKER_ENABLED"),
      lease: {
        seconds: workerLeaseSeconds(),
        heartbeatSeconds: workerHeartbeatIntervalMs() / 1000,
        toleratedHeartbeatFailures: 1,
      },
      queue: {
        queued: queued.count ?? 0,
        running: running.count ?? 0,
        failed: failed.count ?? 0,
        staleLeases: stale.count ?? 0,
      },
      providers: (await configuredRuntimeCapabilities()).map((capability) => ({
        providerId: capability.providerId,
        modelId: capability.modelId,
        kind: capability.kind,
        enabled: capability.enabled,
        policyVersion: capability.policyVersion,
        pricingVersion: capability.pricingVersion,
      })),
      checkedAt: now,
    };
    logHubEvent("debug", "cloud_ai_worker_status_checked", {
      ...logContext,
      queue: body.queue,
    });
    return attachHubRequestId(NextResponse.json(body), logContext);
  } catch (error) {
    logHubError("cloud_ai_worker_status_failed", error, logContext);
    const response = toApiError(
      error,
      "Cloud AI Worker状態を取得できませんでした。",
    );
    return attachHubRequestId(
      NextResponse.json(response.body, { status: response.status }),
      logContext,
    );
  }
}

export async function POST(request: Request) {
  const logContext = createHubRequestContext(request);
  if (!authorized(request)) {
    logHubEvent("warn", "cloud_ai_worker_run_unauthorized", logContext);
    const response = toApiError(
      new AuthenticationRequiredError("認証できません。"),
      "認証できません。",
    );
    return attachHubRequestId(
      NextResponse.json(response.body, { status: response.status }),
      logContext,
    );
  }
  if (!featureFlagEnabled("MANGAI_CLOUD_AI_WORKER_ENABLED")) {
    logHubEvent("warn", "cloud_ai_worker_run_disabled", logContext);
    const response = toApiError(
      new ProviderUnavailableError("Cloud AI Workerは停止中です。"),
      "Worker処理に失敗しました。",
    );
    return attachHubRequestId(
      NextResponse.json(response.body, { status: response.status }),
      logContext,
    );
  }
  const providers = await createConfiguredCloudProviders();
  try {
    const client = createAdminClient();
    const { error: orphanQueueError } = await client.rpc(
      "queue_orphan_cloud_generation_assets",
    );
    if (orphanQueueError)
      logHubError(
        "cloud_generation_orphan_scan_failed",
        orphanQueueError,
        logContext,
      );
    await processPendingCloudStorageCleanup({ client });
    const panelAdoption = await processPendingCloudPanelAdoption({ client });
    const dialoguePlacement = await processPendingCloudDialoguePlacement({ client });
    const dispatch = await dispatchNextCloudGenerationBatchTarget({ client });
    const result = await processNextCloudGenerationJob({
        workerId: process.env.MANGAI_CLOUD_AI_WORKER_ID ?? "next-worker",
        providers,
        leaseSeconds: workerLeaseSeconds(),
        heartbeatIntervalMs: workerHeartbeatIntervalMs(),
        client,
      });
    await client.rpc("refresh_cloud_ai_notifications");
    logHubEvent("info", "cloud_ai_worker_run_completed", {
      ...logContext,
      status: result.status,
      jobId: "jobId" in result ? result.jobId : undefined,
      batchDispatchStatus: dispatch.status,
      panelAdoptionStatus: panelAdoption.status,
      dialoguePlacementStatus: dialoguePlacement.status,
    });
    const response = result.status === "idle" && dispatch.status === "deferred"
      ? { status: "retrying" as const }
      : result.status === "idle" && dispatch.status === "failed"
        ? { status: "failed" as const }
        : result;
    return attachHubRequestId(NextResponse.json(response), logContext);
  } catch (error) {
    logHubError("cloud_ai_worker_run_failed", error, logContext);
    const response = toApiError(error, "Worker処理に失敗しました。");
    return attachHubRequestId(
      NextResponse.json(response.body, { status: response.status }),
      logContext,
    );
  }
}
