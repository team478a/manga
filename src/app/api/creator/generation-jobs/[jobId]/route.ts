import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelCloudGenerationJob } from "@/lib/cloud-creator-server";
import { toApiError } from "@/lib/api-errors";

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
    const response = toApiError(error, "キャンセルに失敗しました。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
