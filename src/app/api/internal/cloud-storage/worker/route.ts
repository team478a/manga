import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { processNextCloudStorageLifecycleJob } from "@/lib/cloud-storage-lifecycle-worker";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.MANGAI_CLOUD_STORAGE_WORKER_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (
    !expected ||
    !supplied ||
    expected.length < 32 ||
    expected.length !== supplied.length
  )
    return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function POST(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: "認証できません。" }, { status: 401 });
  if (process.env.MANGAI_CLOUD_STORAGE_WORKER_ENABLED !== "true")
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
