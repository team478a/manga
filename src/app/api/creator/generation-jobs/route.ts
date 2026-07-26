import { NextResponse } from "next/server";
import { z } from "zod";
import { cloudGenerationInputSchema } from "@mangai/ai-core";
import {
  enqueueCloudGenerationJob,
  listCloudGenerationJobs,
} from "@/lib/cloud-creator-server";
import { enforceCloudAiRateLimit } from "@/lib/cloud-ai-rate-limit";
import { toApiError } from "@/lib/api-errors";
import { RateLimitedError } from "@/lib/domain-errors";

const createSchema = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid().optional(),
  idempotencyKey: z.string().uuid(),
  generation: cloudGenerationInputSchema,
});

export async function GET(request: Request) {
  try {
    const projectId = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("projectId"));
    return NextResponse.json(await listCloudGenerationJobs(projectId));
  } catch (error) {
    const response = toApiError(error, "読込に失敗しました。");
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceCloudAiRateLimit(request);
    if (!rateLimit.allowed) {
      const response = toApiError(
        new RateLimitedError(
          "Cloud AI要求が集中しています。1分後に再試行してください。",
        ),
        "登録に失敗しました。",
      );
      return NextResponse.json(
        response.body,
        {
          status: response.status,
          headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
        },
      );
    }
    const input = createSchema.parse(await request.json());
    return NextResponse.json(
      { id: await enqueueCloudGenerationJob(input) },
      { status: 202 },
    );
  } catch (error) {
    const response = toApiError(error, "登録に失敗しました。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
