import { NextResponse } from "next/server";
import { enforceCloudAiRateLimit } from "@/lib/cloud-ai-rate-limit";
import {
  cloudPanelImageGenerationFeatureEnabled,
} from "@/lib/cloud-panel-image-generation";
import { enqueueStoryboardPanelImage } from "@/lib/cloud-panel-image-generation-server";
import { toApiError } from "@/lib/api-errors";
import { PermissionDeniedError, RateLimitedError } from "@/lib/domain-errors";

export async function POST(request: Request) {
  try {
    if (!cloudPanelImageGenerationFeatureEnabled())
      throw new PermissionDeniedError("ネーム画像生成は現在停止中です。");
    const rateLimit = await enforceCloudAiRateLimit(request);
    if (!rateLimit.allowed) {
      const response = toApiError(
        new RateLimitedError(
          "画像生成要求が集中しています。1分後に再試行してください。",
        ),
        "画像生成を開始できませんでした。",
      );
      return NextResponse.json(response.body, {
        status: response.status,
        headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
      });
    }
    return NextResponse.json(
      await enqueueStoryboardPanelImage(await request.json()),
      { status: 202 },
    );
  } catch (error) {
    const response = toApiError(
      error,
      "画像生成を開始できませんでした。",
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
