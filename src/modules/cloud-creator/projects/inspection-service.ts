import { inspectionFindingSchema, type InspectionFinding } from "@/lib/inspection-finding-contract";
import { DomainError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";
import { getCloudProjectWorkspace } from "./project-service";

export type CloudInspectionFindingRecord = InspectionFinding & { id: string; runId: string; pageId: string | null; panelId: string | null; createdAt: string };

export async function listCloudInspectionFindings(projectId: string, pageId: string) {
  const { supabase } = await cloudCreatorContext();
  const workspace = await getCloudProjectWorkspace(projectId);
  if (!workspace.pages.some((page) => page.id === pageId)) throw new DomainError("RESOURCE_NOT_FOUND", "ページが見つかりません。");
  const result = await supabase.from("cloud_manga_inspection_findings")
    .select("id,run_id,page_id,panel_id,status,category,reason,region,confidence,suggestion,evidence,created_at")
    .eq("project_id", projectId).eq("page_id", pageId).order("created_at", { ascending: false }).limit(300);
  if (result.error?.code === "42P01") return { available: false, findings: [] as CloudInspectionFindingRecord[] };
  if (result.error) throw new DomainError("INTERNAL_ERROR", "品質検査結果を読み込めませんでした。", { cause: result.error });
  return { available: true, findings: (result.data ?? []).map((row: any) => ({ id: row.id, runId: row.run_id, pageId: row.page_id, panelId: row.panel_id, createdAt: row.created_at, ...inspectionFindingSchema.parse({ status: row.status, category: row.category, reason: row.reason, region: row.region, confidence: row.confidence === null ? null : Number(row.confidence), suggestion: row.suggestion, evidence: row.evidence }) })) };
}
