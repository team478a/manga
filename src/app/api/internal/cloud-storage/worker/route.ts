import { NextResponse } from "next/server";
import { processNextCloudStorageLifecycleJob } from "@/lib/cloud-storage-lifecycle-worker";
import { featureFlagEnabled } from "@/lib/feature-flags";
import { hasValidInternalWorkerAuthorization } from "@/lib/internal-worker-auth";

export const runtime = "nodejs";
// Thumbnail rendering downloads source assets before rendering and upload.
export const maxDuration = 180;

function authorized(request: Request) {
  return hasValidInternalWorkerAuthorization(
    request,
    process.env.MANGAI_CLOUD_STORAGE_WORKER_SECRET,
  );
}

export async function POST(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: "認証できません。" }, { status: 401 });
  if (!featureFlagEnabled("MANGAI_CLOUD_STORAGE_WORKER_ENABLED"))
    return NextResponse.json(
      { error: "Storage Workerは停止中です。" },
      { status: 503 },
    );
  try {
    return NextResponse.json(
      await processNextCloudStorageLifecycleJob({
        workerId:
          process.env.MANGAI_CLOUD_STORAGE_WORKER_ID ?? "next-storage-worker",
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "Storage処理に失敗しました。" },
      { status: 500 },
    );
  }
}
