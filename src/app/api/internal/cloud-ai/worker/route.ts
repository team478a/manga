import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type {
  CloudImageGenerationProvider,
  CloudTextGenerationProvider,
} from "@mangai/ai-core";
import {
  MockCloudImageProvider,
  MockCloudTextProvider,
} from "@/lib/cloud-ai-mock-provider";
import {
  processNextCloudGenerationJob,
  processPendingCloudStorageCleanup,
} from "@/lib/cloud-ai-worker";
import { configuredCapabilities } from "@/lib/cloud-ai-registry";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MangaiCloudGatewayImageProvider,
  MangaiCloudGatewayTextProvider,
} from "@/lib/cloud-ai-gateway-provider";
import { toApiError } from "@/lib/api-errors";
import {
  AuthenticationRequiredError,
  ProviderUnavailableError,
} from "@/lib/domain-errors";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.MANGAI_CLOUD_AI_WORKER_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (
    !expected ||
    !supplied ||
    expected.length < 32 ||
    supplied.length !== expected.length
  )
    return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
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
  if (!authorized(request)) {
    const response = toApiError(
      new AuthenticationRequiredError("認証できません。"),
      "認証できません。",
    );
    return NextResponse.json(response.body, { status: response.status });
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
    return NextResponse.json({
      enabled: process.env.MANGAI_CLOUD_AI_WORKER_ENABLED === "true",
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
      providers: configuredCapabilities().map((capability) => ({
        providerId: capability.providerId,
        modelId: capability.modelId,
        kind: capability.kind,
        enabled: capability.enabled,
        policyVersion: capability.policyVersion,
        pricingVersion: capability.pricingVersion,
      })),
      checkedAt: now,
    });
  } catch (error) {
    const response = toApiError(
      error,
      "Cloud AI Worker状態を取得できませんでした。",
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    const response = toApiError(
      new AuthenticationRequiredError("認証できません。"),
      "認証できません。",
    );
    return NextResponse.json(response.body, { status: response.status });
  }
  if (process.env.MANGAI_CLOUD_AI_WORKER_ENABLED !== "true") {
    const response = toApiError(
      new ProviderUnavailableError("Cloud AI Workerは停止中です。"),
      "Worker処理に失敗しました。",
    );
    return NextResponse.json(response.body, { status: response.status });
  }
  const providers: Array<
    CloudImageGenerationProvider | CloudTextGenerationProvider
  > =
    process.env.NODE_ENV !== "production" &&
    process.env.MANGAI_CLOUD_AI_MOCK_ENABLED === "true"
      ? [new MockCloudImageProvider(), new MockCloudTextProvider()]
      : [];
  const gatewayEndpoint = process.env.MANGAI_CLOUD_AI_GATEWAY_ENDPOINT;
  const gatewayKey = process.env.MANGAI_CLOUD_AI_GATEWAY_KEY;
  if (gatewayEndpoint && gatewayKey) {
    for (const capability of configuredCapabilities().filter(
      (candidate) =>
        candidate.enabled && !candidate.providerId.includes("mock"),
    ))
      providers.push(
        capability.kind === "image"
          ? new MangaiCloudGatewayImageProvider({
              endpoint: `${gatewayEndpoint.replace(/\/$/, "")}/image`,
              apiKey: gatewayKey,
              capability,
            })
          : new MangaiCloudGatewayTextProvider({
              endpoint: `${gatewayEndpoint.replace(/\/$/, "")}/text`,
              apiKey: gatewayKey,
              capability,
            }),
      );
  }
  try {
    const client = createAdminClient();
    const { error: orphanQueueError } = await client.rpc(
      "queue_orphan_cloud_generation_assets",
    );
    if (orphanQueueError)
      console.error(
        JSON.stringify({ event: "cloud_generation_orphan_scan_failed" }),
      );
    await processPendingCloudStorageCleanup({ client });
    const result = await processNextCloudGenerationJob({
        workerId: process.env.MANGAI_CLOUD_AI_WORKER_ID ?? "next-worker",
        providers,
        leaseSeconds: workerLeaseSeconds(),
        heartbeatIntervalMs: workerHeartbeatIntervalMs(),
        client,
      });
    await client.rpc("refresh_cloud_ai_notifications");
    return NextResponse.json(result);
  } catch (error) {
    const response = toApiError(error, "Worker処理に失敗しました。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
