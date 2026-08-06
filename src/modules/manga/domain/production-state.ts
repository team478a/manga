import { ValidationError } from "../../../lib/domain-errors.ts";

export type MangaPageProductionStatus =
  | "not_started"
  | "generating"
  | "review_required"
  | "revision_required"
  | "finalized";

export type MangaPageProductionState = {
  pageId: string;
  status: MangaPageProductionStatus;
  statusUpdatedAt: string | null;
  finalizedRevision: number | null;
  reviewedContextRevision: number | null;
  contextRevision: number;
  isStale: boolean;
};

export const cloudPageProductionStatuses = new Set<MangaPageProductionStatus>([
  "not_started",
  "generating",
  "review_required",
  "revision_required",
  "finalized",
]);

export function assertUserSelectableProductionStatus(status: MangaPageProductionStatus) {
  if (!cloudPageProductionStatuses.has(status) || status === "generating")
    throw new ValidationError("ページの制作状態を確認してください。");
}

export function buildPageProductionStates(input: {
  pages: Array<{ id: string }>;
  contextRevision?: number;
  rows?: Array<{
    id: string;
    production_status: unknown;
    production_status_updated_at: string | null;
    finalized_revision: number | null;
    reviewed_context_revision: number | null;
  }>;
}): MangaPageProductionState[] {
  const contextRevision = input.contextRevision ?? 0;
  const byId = new Map((input.rows ?? []).map((row) => [row.id, row]));
  return input.pages.map((page) => {
    const row = byId.get(page.id);
    const status = cloudPageProductionStatuses.has(
      row?.production_status as MangaPageProductionStatus,
    )
      ? (row?.production_status as MangaPageProductionStatus)
      : "not_started";
    const reviewed = row?.reviewed_context_revision == null
      ? null
      : Number(row.reviewed_context_revision);
    return {
      pageId: page.id,
      status,
      statusUpdatedAt: row?.production_status_updated_at ?? null,
      finalizedRevision:
        row?.finalized_revision == null ? null : Number(row.finalized_revision),
      reviewedContextRevision: reviewed,
      contextRevision,
      isStale:
        status === "finalized" && reviewed != null && reviewed < contextRevision,
    };
  });
}
