import { NextResponse } from "next/server";
import { z } from "zod";
import { createCloudExportDownloadUrl } from "@/modules/cloud-creator/export/durable-export-service";
import { toApiError } from "@/lib/api-errors";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const jobId = z.string().uuid().parse((await context.params).jobId);
    return NextResponse.redirect(await createCloudExportDownloadUrl(jobId));
  } catch (error) {
    const response = toApiError(error, "ダウンロードを準備できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
