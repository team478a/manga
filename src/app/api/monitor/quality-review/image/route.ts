import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { toApiError } from "@/lib/api-errors";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { ResourceNotFoundError } from "@/lib/domain-errors";
import { assertMonitorQualityReviewEnabled } from "@/lib/monitor-quality-review";
import { createMonitorQualityReviewCandidateUrl } from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";

const querySchema = z.object({
  assignmentId: z.string().uuid(),
  caseId: z.string().uuid(),
});

export async function GET(request: Request) {
  try {
    assertMonitorQualityReviewEnabled();
    const { profile } = await requireProfile();
    await requireCloudGeneralMonitor(profile.id);
    const url = new URL(request.url);
    const input = querySchema.parse(Object.fromEntries(url.searchParams));
    const signedUrl = await createMonitorQualityReviewCandidateUrl({
      reviewerProfileId: profile.id,
      assignmentId: input.assignmentId,
      caseId: input.caseId,
    });
    if (!signedUrl) throw new ResourceNotFoundError("画像を表示できませんでした。");
    return NextResponse.redirect(signedUrl, 307);
  } catch (error) {
    const response = toApiError(error, "画像を表示できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
