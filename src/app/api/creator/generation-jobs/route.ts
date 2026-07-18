import { NextResponse } from "next/server";
import { z } from "zod";
import { cloudGenerationInputSchema } from "@mangai/ai-core";
import {
  enqueueCloudGenerationJob,
  listCloudGenerationJobs,
} from "@/lib/cloud-creator-server";

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
        status: message.includes("拒否")
          ? 422
          : message.includes("停止中")
            ? 503
            : 400,
      },
    );
  }
}
