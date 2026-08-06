import { cloudCreatorContext } from "../auth-context";
import type { CloudPage, CloudPageProductionStatus } from "../contracts/types";
import { DomainError, ValidationError } from "@/lib/domain-errors";
import {
  assertUserSelectableProductionStatus,
  buildPageProductionStates,
} from "../../manga/domain/production-state";

export async function listCloudPageProductionStates(projectId: string, pages: CloudPage[]) {
  const { supabase } = await cloudCreatorContext();
  const [projectResult, pagesResult] = await Promise.all([
    supabase.from("cloud_projects").select("production_context_revision").eq("id", projectId).maybeSingle(),
    supabase.from("cloud_pages")
      .select("id,production_status,production_status_updated_at,finalized_revision,reviewed_context_revision")
      .eq("project_id", projectId).is("deleted_at", null),
  ]);
  if (projectResult.error?.code === "42703" || pagesResult.error?.code === "42703")
    return buildPageProductionStates({ pages });
  if (projectResult.error || pagesResult.error)
    throw new DomainError("INTERNAL_ERROR", "ページの制作状況を読み込めませんでした。", { cause: projectResult.error ?? pagesResult.error });
  return buildPageProductionStates({
    pages,
    contextRevision: Number(projectResult.data?.production_context_revision ?? 0),
    rows: pagesResult.data ?? [],
  });
}

export async function setCloudPageProductionStatus(pageId: string, status: CloudPageProductionStatus) {
  assertUserSelectableProductionStatus(status);
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("set_cloud_page_production_status", { p_page_id: pageId, p_status: status });
  if (result.error?.code === "42883") throw new ValidationError("制作状態用migrationを適用してください。");
  if (result.error?.message?.includes("cloud_page_finalize_active_jobs"))
    throw new ValidationError("生成処理が完了してからページを確定してください。");
  if (result.error || !result.data)
    throw new DomainError("INTERNAL_ERROR", "ページの制作状態を更新できませんでした。", { cause: result.error });
  return result.data as string;
}
