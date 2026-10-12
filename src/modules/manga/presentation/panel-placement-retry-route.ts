import { NextResponse } from "next/server";
import { z } from "zod";
import { toApiError } from "../../../lib/api-errors.ts";
import { enforceCloudAiRateLimit } from "../../../lib/cloud-ai-rate-limit.ts";
import { RateLimitedError } from "../../../lib/domain-errors.ts";
import { retryPanelPlacement } from "../infrastructure/panel-placement-retry-service.ts";

export async function retryPlacement(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const jobId = z.string().uuid().parse((await context.params).jobId);
    const { pageId } = z.object({ pageId: z.string().uuid() }).strict().parse(await request.json());
    const limit = await enforceCloudAiRateLimit(request);
    if (!limit.allowed) {
      const error = toApiError(new RateLimitedError(), "配置を再試行できませんでした。");
      return NextResponse.json(error.body, {
        status: error.status, headers: { "retry-after": String(limit.retryAfterSeconds) },
      });
    }
    return NextResponse.json(await retryPanelPlacement(jobId, pageId));
  } catch (error) {
    const response = toApiError(error, "配置を再試行できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
