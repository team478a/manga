import { NextResponse } from "next/server";
import { processNextExternalSubmissionIngest } from "@/lib/external-submission-worker";
import { featureFlagEnabled } from "@/lib/feature-flags";
import { hasValidInternalWorkerAuthorization } from "@/lib/internal-worker-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!hasValidInternalWorkerAuthorization(
    request,
    process.env.MANGAI_EXTERNAL_SUBMISSION_WORKER_SECRET,
  )) return NextResponse.json({ error: "認証できません。" }, { status: 401 });
  if (!featureFlagEnabled("MANGAI_EXTERNAL_SUBMISSION_WORKER_ENABLED"))
    return NextResponse.json({ error: "外部作品検証Workerは停止中です。" }, { status: 503 });
  try {
    return NextResponse.json(await processNextExternalSubmissionIngest({
      workerId: process.env.MANGAI_EXTERNAL_SUBMISSION_WORKER_ID ?? "next-external-ingest-worker",
    }));
  } catch {
    return NextResponse.json({ error: "外部作品の検証に失敗しました。" }, { status: 500 });
  }
}
