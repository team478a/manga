import { DomainError, ValidationError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";
import { getCloudManuscriptPreflight } from "./manuscript-preflight-service";

export type CloudProjectCheckpoint = {
  id: string;
  kind: "checkpoint" | "release";
  label: string;
  projectRevision: number;
  productionContextRevision: number;
  pageCount: number;
  manifestSha256: string;
  createdAt: string;
  isCurrent: boolean;
};

export async function listCloudProjectCheckpoints(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const [checkpoints, project] = await Promise.all([
    supabase.from("cloud_project_checkpoints")
      .select("id,kind,label,project_revision,production_context_revision,page_count,manifest_sha256,created_at")
      .eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    supabase.from("cloud_projects").select("revision,production_context_revision").eq("id", projectId).maybeSingle(),
  ]);
  if (checkpoints.error?.code === "42P01") return { available: false, checkpoints: [] as CloudProjectCheckpoint[] };
  if (checkpoints.error || project.error || !project.data)
    throw new DomainError("INTERNAL_ERROR", "作品の固定版履歴を読み込めませんでした。", { cause: checkpoints.error ?? project.error });
  const projectRevision = Number(project.data.revision);
  const productionContextRevision = Number(project.data.production_context_revision);
  return {
    available: true,
    checkpoints: (checkpoints.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind as CloudProjectCheckpoint["kind"],
      label: row.label,
      projectRevision: Number(row.project_revision),
      productionContextRevision: Number(row.production_context_revision),
      pageCount: Number(row.page_count),
      manifestSha256: row.manifest_sha256,
      createdAt: row.created_at,
      isCurrent: Number(row.project_revision) === projectRevision
        && Number(row.production_context_revision) === productionContextRevision,
    })),
  };
}

export async function createCloudProjectCheckpoint(input: { projectId: string; label: string; kind: "checkpoint" | "release" }) {
  if (input.kind === "release") {
    const report = await getCloudManuscriptPreflight(input.projectId, { requireFinalizedPages: true });
    if (!report.ready) throw new ValidationError("原稿チェックを解消し、すべてのページを確定してから完成版を固定してください。");
  }
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("create_cloud_project_checkpoint", {
    p_project_id: input.projectId,
    p_label: input.label,
    p_kind: input.kind,
  });
  if (error?.code === "42883") throw new ValidationError("作品バックアップ用migrationを適用してください。");
  if (error?.message?.includes("generation_active")) throw new ValidationError("画像生成が完了してから固定版を作成してください。");
  if (error?.message?.includes("snapshot_missing")) throw new ValidationError("すべてのページを一度保存してから固定版を作成してください。");
  if (error?.message?.includes("pages_not_finalized")) throw new ValidationError("すべてのページを確認して確定してください。");
  if (error || !data) throw new DomainError("INTERNAL_ERROR", "作品の固定版を作成できませんでした。", { cause: error });
  return String(data);
}
