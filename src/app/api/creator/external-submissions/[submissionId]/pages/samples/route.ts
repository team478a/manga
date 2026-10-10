import { NextResponse } from "next/server";
import { z } from "zod";
import { toApiError } from "@/lib/api-errors";
import { setExternalSubmissionSamplePages } from "@/lib/external-submission-upload";

const payloadSchema = z.object({ pageIds: z.array(z.string().uuid()).min(1).max(10) });

export async function PUT(
  request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  try {
    const { submissionId } = await context.params;
    z.string().uuid().parse(submissionId);
    const payload = payloadSchema.parse(await request.json());
    await setExternalSubmissionSamplePages(submissionId, payload.pageIds);
    return NextResponse.json({ updated: true });
  } catch (error) {
    const response = toApiError(error, "試し読みページを保存できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
