import { analyzeCloudManuscript } from "@/lib/cloud-manuscript-preflight";
import { DomainError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";
import { normalizeCloudCanvas } from "../canvas/canvas-normalizer";
import { getCloudProjectWorkspace } from "./project-service";

export async function getCloudManuscriptPreflight(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const workspace = await getCloudProjectWorkspace(projectId);
  const pageIds = workspace.pages.map((page) => page.id);
  const [snapshotsResult, assetsResult] = await Promise.all([
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
  ]);
  if (snapshotsResult.error || assetsResult.error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "原稿の完成状況を確認できませんでした。",
      { cause: snapshotsResult.error ?? assetsResult.error },
    );
  const latestSnapshots = new Map<string, unknown>();
  for (const snapshot of snapshotsResult.data ?? []) {
    if (!latestSnapshots.has(snapshot.page_id))
      latestSnapshots.set(snapshot.page_id, snapshot.canvas);
  }
  return analyzeCloudManuscript({
    coverPageId: workspace.project.cover_page_id,
    pages: workspace.pages.map((page) => ({
      id: page.id,
      page_number: page.page_number,
      canvas: normalizeCloudCanvas(page, latestSnapshots.get(page.id)),
    })),
    assets: assetsResult.data ?? [],
  });
}
