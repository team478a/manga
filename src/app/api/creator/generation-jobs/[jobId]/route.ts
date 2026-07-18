import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelCloudGenerationJob } from "@/lib/cloud-creator-server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const jobId = z
      .string()
      .uuid()
      .parse((await context.params).jobId);
    return NextResponse.json({ id: await cancelCloudGenerationJob(jobId) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "キャンセルに失敗しました。",
      },
      { status: 400 },
    );
  }
}
