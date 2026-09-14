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
  type MonitorQualityReviewDraft,
} from "@/modules/manga-quality/domain/monitor-quality-review";
import { monitorQualityReviewAdjudicationDifferenceSchema } from
  "@/modules/manga-quality/domain/monitor-quality-review-adjudication";
import {
  abstainMonitorQualityReviewAdjudication,
  consentMonitorQualityReviewAdjudication,
  loadMonitorQualityReviewAdjudicationWorkspace,
  lockMonitorQualityReviewAdjudicationIndependent,
  revealMonitorQualityReviewAdjudicationDifferences,
  saveMonitorQualityReviewAdjudicationDraft,
  submitMonitorQualityReviewAdjudication,
} from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";

const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,120}$/);
const commonSchema = {
  adjudicationId: z.string().uuid(),
  idempotencyKey: idempotencyKeySchema,
};
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("consent"), ...commonSchema }).strict(),
  z.object({ action: z.literal("save"), ...commonSchema, draft: monitorQualityReviewDraftSchema }).strict(),
  z.object({
    action: z.literal("lock_independent"),
    ...commonSchema,
    draft: monitorQualityReviewDraftSchema,
    confirmation: z.literal("lock_blind_judgment"),
  }).strict(),
  z.object({
    action: z.literal("reveal_differences"),
    ...commonSchema,
    confirmation: z.literal("reveal_anonymous_differences"),
  }).strict(),
  z.object({
    action: z.literal("submit"),
    ...commonSchema,
    draft: monitorQualityReviewDraftSchema,
    decisionReason: z.string().trim().min(1).max(500),
    confirmation: z.literal("submit_final_adjudication"),
  }).strict(),
  z.object({
    action: z.literal("abstain"),
    ...commonSchema,
    reason: z.string().trim().min(1).max(500),
    confirmation: z.literal("abstain_with_reason"),
  }).strict(),
]);

function toStoredPayload(draft: MonitorQualityReviewDraft, caseKey: string) {
  return {
    case_id: caseKey,
    verdict: draft.verdict,
    confidence: draft.confidence,
    defects: draft.defects,
    overall_comment: draft.overallComment,
  };
}

function throwSafeMutationError(error: { message: string } | null) {
  if (!error) return;
  if (error.message.includes("source_changed"))
    throw new ValidationError("元の回答が更新されたため、この裁定は続行できません。管理者へ連絡してください。");
  if (error.message.includes("differences_locked"))
    throw new ValidationError("独立判定を確定するまでは差分を表示できません。");
  if (error.message.includes("reason_invalid"))
    throw new ValidationError("理由を1〜500文字で入力してください。");
  if (error.message.includes("payload_invalid"))
    throw new ValidationError("判定内容を確認してください。");
  throw new ValidationError("現在の状態ではこの操作を実行できません。画面を再読み込みしてください。");
}

export async function POST(request: Request) {
  try {
    assertMonitorQualityReviewEnabled();
    const { profile } = await requireProfile();
    await requireCloudGeneralMonitor(profile.id);
    const input = requestSchema.parse(await request.json());
    const workspace = await loadMonitorQualityReviewAdjudicationWorkspace(
      profile.id,
      input.adjudicationId,
    );
    if (!workspace.configured)
      throw new ValidationError("裁定機能の準備が完了していません。");
    if (!workspace.adjudication || !workspace.reviewCase
      || workspace.adjudication.id !== input.adjudicationId)
      throw new ValidationError("割り当てられた裁定作業が見つかりません。");

    if (input.action === "consent") {
      const result = await consentMonitorQualityReviewAdjudication(input);
      throwSafeMutationError(result.error);
      return NextResponse.json({ ok: true });
    }
    if (input.action === "reveal_differences") {
      if (workspace.adjudication.status !== "independent_locked")
        throw new ValidationError("独立判定を確定してから差分を表示してください。");
      const result = await revealMonitorQualityReviewAdjudicationDifferences(input);
      throwSafeMutationError(result.error);
      const difference = monitorQualityReviewAdjudicationDifferenceSchema.safeParse(
        Array.isArray(result.data) ? result.data[0] : null,
      );
      if (!difference.success || difference.data.case_key !== workspace.reviewCase.case_key)
        throw new ValidationError("匿名差分を安全に表示できませんでした。");
      return NextResponse.json({ ok: true, difference: difference.data });
    }
    if (input.action === "abstain") {
      const result = await abstainMonitorQualityReviewAdjudication(input);
      throwSafeMutationError(result.error);
      return NextResponse.json({ ok: true, abstained: true });
    }

    if (input.draft.caseId !== workspace.reviewCase.id)
      throw new ValidationError("裁定対象の画像が一致しません。");
    const complete = input.action !== "save";
    if (complete) {
      validateCompletedMonitorQualityReview({
        caseKey: workspace.reviewCase.case_key,
        allowedDefectCategories: workspace.reviewCase.allowed_defect_categories,
        draft: input.draft,
      });
    }
    const payload = toStoredPayload(input.draft, workspace.reviewCase.case_key);
    if (input.action === "save") {
      const result = await saveMonitorQualityReviewAdjudicationDraft({ ...input, payload });
      throwSafeMutationError(result.error);
      return NextResponse.json({ ok: true, saved: true });
    }
    if (input.action === "lock_independent") {
      const result = await lockMonitorQualityReviewAdjudicationIndependent({ ...input, payload });
      throwSafeMutationError(result.error);
      return NextResponse.json({ ok: true, locked: true });
    }
    if (!workspace.adjudication.differences_revealed_at)
      throw new ValidationError("匿名差分を確認してから最終裁定を送信してください。");
    const result = await submitMonitorQualityReviewAdjudication({ ...input, payload });
    throwSafeMutationError(result.error);
    return NextResponse.json({ ok: true, submitted: true });
  } catch (error) {
    const response = toApiError(error, "裁定結果を保存できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
