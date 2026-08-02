import { createAdminClient } from "@/lib/supabase/admin";
import { DomainError, ValidationError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";
import { getCloudManuscriptPreflight } from "../projects/manuscript-preflight-service";

export type CloudExportJob = {
  id: string;
  projectId: string;
  format: "pdf";
  status: "queued" | "running" | "paused" | "completed" | "failed" | "canceled";
  totalPages: number;
  completedPages: number;
  progress: number;
  errorCode: string | null;
  createdAt: string;
  finishedAt: string | null;
  downloadable: boolean;
};

function mapJob(row: Record<string, unknown>): CloudExportJob {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    format: "pdf",
    status: row.status as CloudExportJob["status"],
    totalPages: Number(row.total_pages),
    completedPages: Number(row.completed_pages),
    progress: Number(row.progress),
    errorCode: typeof row.error_code === "string" ? row.error_code : null,
    createdAt: String(row.created_at),
    finishedAt: typeof row.finished_at === "string" ? row.finished_at : null,
    downloadable: row.status === "completed" && typeof row.output_storage_path === "string",
  };
}

export async function listCloudExportJobs(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase
    .from("cloud_export_jobs")
    .select("id,project_id,format,status,total_pages,completed_pages,progress,error_code,output_storage_path,created_at,finished_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error?.code === "42P01") return { available: false, jobs: [] as CloudExportJob[] };
  if (error) throw new DomainError("INTERNAL_ERROR", "書き出し履歴を読み込めませんでした。", { cause: error });
  return { available: true, jobs: (data ?? []).map((row) => mapJob(row as Record<string, unknown>)) };
}

export async function createCloudExportJob(projectId: string) {
  const report = await getCloudManuscriptPreflight(projectId, { requireFinalizedPages: true });
  if (!report.ready) throw new ValidationError("原稿チェックの要修正項目を解消し、すべてのページを確定してください。");
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("create_cloud_export_job", { p_project_id: projectId, p_format: "pdf" });
  if (error?.code === "42883") throw new ValidationError("長編書き出し用migrationを適用してください。");
  if (error?.message?.includes("cloud_export_already_active")) throw new ValidationError("進行中の書き出しがあります。");
  if (error || !data) throw new DomainError("INTERNAL_ERROR", "書き出しを開始できませんでした。", { cause: error });
  return String(data);
}

export async function setCloudExportJobState(jobId: string, status: "queued" | "paused" | "canceled") {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("set_cloud_export_job_state", { p_job_id: jobId, p_status: status });
  if (error || !data) throw new DomainError("INTERNAL_ERROR", "書き出し状態を変更できませんでした。", { cause: error });
  return String(data);
}

export async function createCloudExportDownloadUrl(jobId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase
    .from("cloud_export_jobs")
    .select("output_bucket,output_storage_path,status")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data || data.status !== "completed" || !data.output_storage_path)
    throw new ValidationError("完成した書き出しファイルがありません。");
  const admin = createAdminClient();
  const signed = await admin.storage
    .from(data.output_bucket ?? "cloud-exports")
    .createSignedUrl(data.output_storage_path, 300, { download: "mangai-manuscript.pdf" });
  if (signed.error || !signed.data?.signedUrl)
    throw new DomainError("INTERNAL_ERROR", "ダウンロードを準備できませんでした。", { cause: signed.error });
  return signed.data.signedUrl;
}
