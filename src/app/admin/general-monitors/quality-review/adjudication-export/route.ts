import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { loadMonitorQualityReviewAdjudicationSummary } from
  "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";

export async function GET(request: Request) {
  await requireAdmin();
  const batchId = z.string().uuid().parse(new URL(request.url).searchParams.get("batchId"));
  const summary = await loadMonitorQualityReviewAdjudicationSummary(batchId);
  if (!summary)
    return NextResponse.json({ error: "匿名裁定集計を作成できませんでした。" }, { status: 404 });
  return new NextResponse(`${JSON.stringify(summary, null, 2)}\n`, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": "attachment; filename=monitor-quality-review-adjudication-summary.private.json",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
