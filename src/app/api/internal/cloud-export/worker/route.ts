import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { processNextCloudExportJob } from "@/lib/cloud-export-worker";

export const runtime = "nodejs";
// A segment renders up to eight pages and the last segment also merges the PDF.
export const maxDuration = 300;

function authorized(request: Request) {
  const expected = process.env.MANGAI_CLOUD_EXPORT_WORKER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied || expected.length < 32 || expected.length !== supplied.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "認証できません。" }, { status: 401 });
  if (process.env.MANGAI_CLOUD_EXPORT_WORKER_ENABLED !== "true")
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
