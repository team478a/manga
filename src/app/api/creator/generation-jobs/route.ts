import { NextResponse } from "next/server";
import { z } from "zod";
import { cloudGenerationInputSchema } from "@mangai/ai-core";
import {
  enqueueCloudGenerationJob,
  listCloudGenerationJobs,
} from "@/lib/cloud-creator-server";
import { enforceCloudAiRateLimit } from "@/lib/cloud-ai-rate-limit";

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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "読込に失敗しました。",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceCloudAiRateLimit(request);
    if (!rateLimit.allowed)
      return NextResponse.json(
        { error: "Cloud AI要求が集中しています。1分後に再試行してください。" },
        {
          status: 429,
          headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
        },
      );
    const input = createSchema.parse(await request.json());
    return NextResponse.json(
      { id: await enqueueCloudGenerationJob(input) },
      { status: 202 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "登録に失敗しました。";
    return NextResponse.json(
      { error: message },
      {
        status: message.includes("集中")
          ? 429
          : message.includes("拒否")
            ? 422
            : message.includes("停止中")
              ? 503
              : 400,
      },
    );
  }
}
