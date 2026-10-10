import { NextResponse } from "next/server";
import { z } from "zod";
import { toApiError } from "@/lib/api-errors";
import { queueExternalSubmissionValidation } from "@/lib/external-submission-upload";

export async function POST(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  try {
    const { submissionId } = await context.params;
    z.string().uuid().parse(submissionId);
    const jobId = await queueExternalSubmissionValidation(submissionId);
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    const response = toApiError(error, "検証を開始できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
