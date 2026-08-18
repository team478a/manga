import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { toApiError } from "@/lib/api-errors";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { ValidationError } from "@/lib/domain-errors";
import { assertMonitorQualityReviewEnabled } from "@/lib/monitor-quality-review";
import {
  monitorQualityReviewDraftSchema,
  validateCompletedMonitorQualityReview,
} from "@/modules/manga-quality/domain/monitor-quality-review";
import {
  consentMonitorQualityReview,
  loadMonitorQualityReviewWorkspace,
  saveMonitorQualityReviewCase,
  submitMonitorQualityReview,
} from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("consent"), assignmentId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("save"), assignmentId: z.string().uuid(), draft: monitorQualityReviewDraftSchema }).strict(),
  z.object({ action: z.literal("submit"), assignmentId: z.string().uuid() }).strict(),
]);

export async function POST(request: Request) {
  try {
    assertMonitorQualityReviewEnabled();
    const { profile } = await requireProfile();
    await requireCloudGeneralMonitor(profile.id);
    const input = requestSchema.parse(await request.json());
    const workspace = await loadMonitorQualityReviewWorkspace(profile.id);
    if (!workspace.assignment || workspace.assignment.id !== input.assignmentId)
      throw new ValidationError("割り当てられた確認作業が見つかりません。");
    if (input.action === "consent") {
      const result = await consentMonitorQualityReview(input.assignmentId);
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true });
    }
    if (input.action === "submit") {
      const result = await submitMonitorQualityReview(input.assignmentId);
      if (result.error) {
        if (result.error.message.includes("incomplete"))
          throw new ValidationError("未確定の画像があります。すべての判定を確定してください。");
        throw result.error;
      }
      return NextResponse.json({ ok: true, submitted: true });
    }
    const reviewCase = workspace.cases.find((item) => item.id === input.draft.caseId);
    if (!reviewCase) throw new ValidationError("確認対象の画像が見つかりません。");
    if (input.draft.complete) {
      validateCompletedMonitorQualityReview({
        caseKey: reviewCase.case_key,
        allowedDefectCategories: reviewCase.allowed_defect_categories,
        draft: input.draft,
      });
    }
    const result = await saveMonitorQualityReviewCase({
      assignmentId: input.assignmentId,
      caseId: input.draft.caseId,
      complete: input.draft.complete,
      payload: {
        verdict: input.draft.verdict,
        confidence: input.draft.confidence,
        defects: input.draft.defects,
        overall_comment: input.draft.overallComment,
      },
    });
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, completed: input.draft.complete });
  } catch (error) {
    const response = toApiError(error, "判定結果を保存できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
