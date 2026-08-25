import { analyzeCloudManuscript } from "@/lib/cloud-manuscript-preflight";
import { DomainError } from "@/lib/domain-errors";
import { buildCloudProductionProgress } from "@/lib/cloud-production-progress";
import { cloudCreatorContext } from "../auth-context";
import { normalizeCloudCanvas } from "../canvas/canvas-normalizer";
import { getCloudProjectWorkspace } from "./project-service";
import { listCloudPageProductionStates } from "../production/production-status-service";
import { resolveCompletionModeProfile } from "@mangai/shared";

export async function getCloudManuscriptPreflight(
  projectId: string,
  options?: { requireFinalizedPages?: boolean },
) {
  const { supabase } = await cloudCreatorContext();
  const workspace = await getCloudProjectWorkspace(projectId);
  const completionModeProfile = resolveCompletionModeProfile(workspace.project.completion_mode_profile);
  const pageIds = workspace.pages.map((page) => page.id);
  const [snapshotsResult, assetsResult, activeJobsResult, findingsResult] = await Promise.all([
    pageIds.length
      ? supabase
          .from("cloud_canvas_snapshots")
          .select("page_id,revision,canvas")
          .in("page_id", pageIds)
          .order("revision", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("cloud_assets")
      .select("id,width,height")
      .eq("project_id", projectId)
      .is("deleted_at", null),
    options?.requireFinalizedPages && pageIds.length
      ? supabase
          .from("cloud_generation_jobs")
          .select("page_id")
          .in("page_id", pageIds)
          .in("status", ["queued", "running"])
      : Promise.resolve({ data: [], error: null }),
    completionModeProfile?.requiredChecks.includes("quality_findings")
      ? supabase.from("cloud_manga_inspection_findings")
          .select("page_id,panel_id,status,category,reason,created_at")
          .eq("project_id", projectId).order("created_at", { ascending: false }).limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const findingsUnavailable = findingsResult.error?.code === "42P01";
  if (snapshotsResult.error || assetsResult.error || activeJobsResult.error || (findingsResult.error && !findingsUnavailable))
    throw new DomainError(
      "INTERNAL_ERROR",
      "原稿の完成状況を確認できませんでした。",
      { cause: snapshotsResult.error ?? assetsResult.error ?? activeJobsResult.error ?? findingsResult.error },
    );
  const latestSnapshots = new Map<string, unknown>();
  for (const snapshot of snapshotsResult.data ?? []) {
    if (!latestSnapshots.has(snapshot.page_id))
      latestSnapshots.set(snapshot.page_id, snapshot.canvas);
  }
  const productionStates = options?.requireFinalizedPages
    ? await listCloudPageProductionStates(projectId, workspace.pages)
    : undefined;
  const latestFindings = new Map<string, { status: "PASS" | "WARNING" | "FAIL" | "NOT_EVALUATED"; reason: string; pageId: string | null; panelId: string | null }>();
  for (const row of findingsResult.data ?? []) {
    const key = `${row.page_id ?? "project"}:${row.panel_id ?? "page"}:${row.category}`;
    if (!latestFindings.has(key) && ["PASS", "WARNING", "FAIL", "NOT_EVALUATED"].includes(row.status))
      latestFindings.set(key, { status: row.status as "PASS" | "WARNING" | "FAIL" | "NOT_EVALUATED", reason: row.reason, pageId: row.page_id, panelId: row.panel_id });
  }
  return analyzeCloudManuscript({
    coverPageId: workspace.project.cover_page_id,
    pages: workspace.pages.map((page) => ({
      id: page.id,
      page_number: page.page_number,
      canvas: normalizeCloudCanvas(page, latestSnapshots.get(page.id)),
    })),
    assets: assetsResult.data ?? [],
    productionStates,
    activeGenerationPageIds: (activeJobsResult.data ?? [])
      .map((row) => row.page_id)
      .filter((id): id is string => Boolean(id)),
    requireFinalizedPages: options?.requireFinalizedPages,
    completionModeProfile,
    qualityFindings: [...latestFindings.values()],
    qualityFindingsAvailable: !findingsUnavailable,
  });
}

export async function getCloudProductionProgress(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const manuscript = await getCloudManuscriptPreflight(projectId);
  const { data, error } = await supabase
    .from("cloud_generation_jobs")
    .select("page_id,status,created_at,input,idempotency_key")
    .eq("project_id", projectId)
    .eq("kind", "image")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "作品の生成進捗を確認できませんでした。",
      { cause: error },
    );
  const jobs = (data ?? []).map((row) => {
    const jobInput =
      row.input && typeof row.input === "object"
        ? (row.input as Record<string, unknown>)
        : null;
    return {
      page_id: row.page_id,
      target_panel_id:
        typeof jobInput?.targetPanelId === "string"
          ? jobInput.targetPanelId
          : null,
      operation_id: row.idempotency_key.replace(/:candidate:\d+$/, ""),
      status: row.status,
      created_at: row.created_at,
    };
  });
  return {
    manuscript,
    ...buildCloudProductionProgress({ pages: manuscript.pageProgress, jobs }),
  };
}
