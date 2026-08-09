import { NextResponse } from "next/server";
import { processNextCloudExportJob } from "@/lib/cloud-export-worker";
import { featureFlagEnabled } from "@/lib/feature-flags";
import { hasValidInternalWorkerAuthorization } from "@/lib/internal-worker-auth";

export const runtime = "nodejs";
// A segment renders up to eight pages and the last segment also merges the PDF.
export const maxDuration = 300;

function authorized(request: Request) {
  return hasValidInternalWorkerAuthorization(
    request,
    process.env.MANGAI_CLOUD_EXPORT_WORKER_SECRET,
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "認証できません。" }, { status: 401 });
  if (!featureFlagEnabled("MANGAI_CLOUD_EXPORT_WORKER_ENABLED"))
    return NextResponse.json({ error: "書き出しWorkerは停止中です。" }, { status: 503 });
  try {
    const result = await processNextCloudExportJob({
      workerId: process.env.MANGAI_CLOUD_EXPORT_WORKER_ID ?? "next-export-worker",
      leaseSeconds: 300,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "書き出し処理に失敗しました。" }, { status: 500 });
  }
}
