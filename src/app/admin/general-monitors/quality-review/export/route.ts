import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { humanReviewResponseSchema } from "@/modules/manga-quality/domain/human-review-package";
import {
  isMonitorQualityReviewPrimarySlot,
  MONITOR_PANEL_REVIEW_TEMPLATE_VERSION,
  monitorPanelReviewResponseSchema,
} from "@/modules/manga-quality/domain/monitor-quality-review";
import { loadMonitorQualityReviewExport } from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";

export async function GET(request: Request) {
  await requireAdmin();
  const assignmentId = z.string().uuid().parse(new URL(request.url).searchParams.get("assignmentId"));
  const data = await loadMonitorQualityReviewExport(assignmentId);
  if (!data) return NextResponse.json({ error: "送信済み回答が見つかりません。" }, { status: 404 });
  const responses = new Map(data.responses.map((item) => [item.case_id, item]));
  const primary = isMonitorQualityReviewPrimarySlot(data.assignment.reviewer_slot);
  const payloadInput = {
    template_version: primary ? "mangai-human-review-v2" : MONITOR_PANEL_REVIEW_TEMPLATE_VERSION,
    slot: data.assignment.reviewer_slot,
    reviewer_id: `monitor_${data.assignment.reviewer_profile_id.replaceAll("-", "")}`,
    reviewer_kind: "human",
    independent: true,
    reviewed_at: data.assignment.submitted_at,
    records: data.cases.map((item) => {
      const response = responses.get(item.id);
      if (!response?.case_completed_at) throw new Error("monitor_quality_review_export_incomplete");
      return { case_id: item.case_key, ...(response.response_payload as object) };
    }),
  };
  const payload = primary
    ? humanReviewResponseSchema.parse(payloadInput)
    : monitorPanelReviewResponseSchema.parse(payloadInput);
  return new NextResponse(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="human-review-${data.assignment.reviewer_slot}.private.json"`,
      "content-type": "application/json; charset=utf-8",
    },
  });
}
