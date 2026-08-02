import { cloudCreatorContext } from "../auth-context";
import type { CloudPage, CloudPageProductionState, CloudPageProductionStatus } from "../contracts/types";
import { DomainError, ValidationError } from "@/lib/domain-errors";

const statuses = new Set<CloudPageProductionStatus>([
  "not_started", "generating", "review_required", "revision_required", "finalized",
]);

function defaults(pages: CloudPage[]): CloudPageProductionState[] {
  return pages.map((page) => ({
    pageId: page.id,
    status: "not_started",
    statusUpdatedAt: null,
    finalizedRevision: null,
    reviewedContextRevision: null,
    contextRevision: 0,
    isStale: false,
  }));
}

export async function listCloudPageProductionStates(projectId: string, pages: CloudPage[]) {
  const { supabase } = await cloudCreatorContext();
  const [projectResult, pagesResult] = await Promise.all([
    supabase.from("cloud_projects").select("production_context_revision").eq("id", projectId).maybeSingle(),
    supabase.from("cloud_pages")
      .select("id,production_status,production_status_updated_at,finalized_revision,reviewed_context_revision")
      .eq("project_id", projectId).is("deleted_at", null),
  ]);
  if (projectResult.error?.code === "42703" || pagesResult.error?.code === "42703") return defaults(pages);
  if (projectResult.error || pagesResult.error)
    throw new DomainError("INTERNAL_ERROR", "ページの制作状況を読み込めませんでした。", { cause: projectResult.error ?? pagesResult.error });
  const contextRevision = Number(projectResult.data?.production_context_revision ?? 0);
  const byId = new Map((pagesResult.data ?? []).map((row) => [row.id, row]));
  return pages.map((page): CloudPageProductionState => {
    const row = byId.get(page.id);
    const status = statuses.has(row?.production_status as CloudPageProductionStatus)
      ? row?.production_status as CloudPageProductionStatus : "not_started";
    const reviewed = row?.reviewed_context_revision == null ? null : Number(row.reviewed_context_revision);
    return {
      pageId: page.id,
      status,
      statusUpdatedAt: row?.production_status_updated_at ?? null,
      finalizedRevision: row?.finalized_revision == null ? null : Number(row.finalized_revision),
      reviewedContextRevision: reviewed,
      contextRevision,
      isStale: status === "finalized" && reviewed != null && reviewed < contextRevision,
    };
  });
}

export async function setCloudPageProductionStatus(pageId: string, status: CloudPageProductionStatus) {
  if (!statuses.has(status) || status === "generating")
    throw new ValidationError("ページの制作状態を確認してください。");
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("set_cloud_page_production_status", { p_page_id: pageId, p_status: status });
  if (result.error?.code === "42883") throw new ValidationError("制作状態用migrationを適用してください。");
  if (result.error?.message?.includes("cloud_page_finalize_active_jobs"))
    throw new ValidationError("生成処理が完了してからページを確定してください。");
  if (result.error || !result.data)
    throw new DomainError("INTERNAL_ERROR", "ページの制作状態を更新できませんでした。", { cause: result.error });
  return result.data as string;
}
