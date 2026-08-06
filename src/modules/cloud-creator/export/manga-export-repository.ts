import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCloudCanvas } from "../canvas/canvas-normalizer";
import type { ExportJobClaim } from "./export-plan";

export type MangaExportAdminClient = ReturnType<typeof createAdminClient>;

type ClaimedExportJobRow = {
  id: string;
  project_id: string;
  created_by_profile_id: string;
  page_ids: string[];
  total_pages: number;
  completed_pages: number;
  segment_size: number;
  lease_token: string;
};

export function createMangaExportRepositoryClient() {
  return createAdminClient();
}

export async function claimExportJob(
  client: MangaExportAdminClient,
  workerId: string,
  leaseSeconds: number,
): Promise<ExportJobClaim | null> {
  const claim = await client.rpc("claim_cloud_export_job", {
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
  if (claim.error) throw new Error("export_job_claim_failed");
  const row = claim.data?.[0] as ClaimedExportJobRow | undefined;
  return row
    ? {
        id: row.id,
        projectId: row.project_id,
        ownerProfileId: row.created_by_profile_id,
        pageIds: row.page_ids,
        totalPages: row.total_pages,
        completedPages: row.completed_pages,
        segmentSize: row.segment_size,
        leaseToken: row.lease_token,
      }
    : null;
}

export async function loadExportSegment(
  client: MangaExportAdminClient,
  projectId: string,
  pageIds: string[],
) {
  const pagesResult = await client
    .from("cloud_pages")
    .select(
      "id,page_number,width,height,background_color,revision,project_id,episode_id,order_index",
    )
    .in("id", pageIds)
    .eq("project_id", projectId);
  if (pagesResult.error || pagesResult.data?.length !== pageIds.length)
    throw new Error("export_pages_missing");

  const snapshotsResult = await client
    .from("cloud_canvas_snapshots")
    .select("page_id,revision,canvas")
    .in("page_id", pageIds)
    .order("revision", { ascending: false });
  if (snapshotsResult.error) throw new Error("export_snapshots_missing");
  const latest = new Map<string, unknown>();
  for (const row of snapshotsResult.data ?? [])
    if (!latest.has(row.page_id)) latest.set(row.page_id, row.canvas);

  return [...(pagesResult.data ?? [])]
    .sort((a, b) => pageIds.indexOf(a.id) - pageIds.indexOf(b.id))
    .map((page) => ({
      page,
      canvas: normalizeCloudCanvas(page, latest.get(page.id)),
    }));
}

export async function loadExportAssets(
  client: MangaExportAdminClient,
  projectId: string,
  assetIds: string[],
) {
  if (!assetIds.length) return [];
  const result = await client
    .from("cloud_assets")
    .select("id,storage_path,mime_type")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .in("id", assetIds);
  if (result.error || result.data?.length !== assetIds.length)
    throw new Error("export_assets_missing");
  return result.data ?? [];
}

export async function loadProjectDpi(
  client: MangaExportAdminClient,
  projectId: string,
) {
  const result = await client
    .from("cloud_projects")
    .select("dpi")
    .eq("id", projectId)
    .single();
  if (result.error || !result.data) throw new Error("export_project_missing");
  return result.data.dpi;
}

export async function listExportSegmentPaths(
  client: MangaExportAdminClient,
  jobId: string,
) {
  const result = await client
    .from("cloud_export_segments")
    .select("segment_index,pdf_storage_path")
    .eq("job_id", jobId)
    .order("segment_index");
  if (result.error) throw new Error("export_segments_missing");
  return (result.data ?? []).map((segment) => segment.pdf_storage_path);
}

export async function completeExportSegment(
  client: MangaExportAdminClient,
  input: {
    jobId: string;
    leaseToken: string;
    segmentIndex: number;
    pageCount: number;
    pdfStoragePath: string;
    pageStoragePaths: string[];
    outputStoragePath: string | null;
    outputByteSize: number | null;
  },
) {
  const result = await client.rpc("complete_cloud_export_segment", {
    p_job_id: input.jobId,
    p_lease_token: input.leaseToken,
    p_segment_index: input.segmentIndex,
    p_page_count: input.pageCount,
    p_pdf_storage_path: input.pdfStoragePath,
    p_page_storage_paths: input.pageStoragePaths,
    p_output_storage_path: input.outputStoragePath,
    p_output_byte_size: input.outputByteSize,
  });
  if (result.error) throw new Error("export_job_finish_failed");
}

export async function failExportJob(
  client: MangaExportAdminClient,
  jobId: string,
  leaseToken: string,
  errorCode: string,
) {
  await client.rpc("fail_cloud_export_job", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_error_code: errorCode,
    p_retryable: true,
  });
}
