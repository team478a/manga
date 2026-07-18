import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  MockCloudImageProvider,
  MockCloudTextProvider,
} from "@/lib/cloud-ai-mock-provider";
import { processNextCloudGenerationJob } from "@/lib/cloud-ai-worker";

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

export async function POST(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: "認証できません。" }, { status: 401 });
  const providers =
    process.env.NODE_ENV !== "production" &&
    process.env.MANGAI_CLOUD_AI_MOCK_ENABLED === "true"
      ? [new MockCloudImageProvider(), new MockCloudTextProvider()]
      : [];
  try {
    return NextResponse.json(
      await processNextCloudGenerationJob({
        workerId: process.env.MANGAI_CLOUD_AI_WORKER_ID ?? "next-worker",
        providers,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Worker処理に失敗しました。",
      },
      { status: 500 },
    );
  }
}
