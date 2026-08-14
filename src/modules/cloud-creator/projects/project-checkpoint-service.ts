import { DomainError, ValidationError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";
import { getCloudManuscriptPreflight } from "./manuscript-preflight-service";
import { assertCloudProjectComplete } from "./page-completion-service";
import { summarizeCloudCheckpointDiff, type CloudCheckpointDiff } from "./project-checkpoint-diff";
import {
  createProjectCheckpoint,
  restoreProjectCheckpoint,
  type ProjectCheckpointCommandRepository,
} from "../../manga/application/manage-project-checkpoint";

export type CloudProjectCheckpoint = {
  id: string;
  kind: "checkpoint" | "release";
  label: string;
  projectRevision: number;
  productionContextRevision: number;
  pageCount: number;
  manifestSha256: string;
  createdAt: string;
  lastRestoredAt: string | null;
  diff: CloudCheckpointDiff;
  isCurrent: boolean;
};

export async function listCloudProjectCheckpoints(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const [checkpoints, project, restores] = await Promise.all([
    supabase.from("cloud_project_checkpoints")
      .select("id,kind,label,project_revision,production_context_revision,page_count,manifest_sha256,manifest,created_at")
      .eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    supabase.from("cloud_projects").select("revision,production_context_revision,title,description,reading_direction,width,height,dpi").eq("id", projectId).maybeSingle(),
    supabase.from("cloud_project_checkpoint_restores")
      .select("checkpoint_id,result_project_revision,restored_at")
      .eq("project_id", projectId).order("restored_at", { ascending: false }).limit(20),
  ]);
  if (checkpoints.error?.code === "42P01") return { available: false, restoreAvailable: false, checkpoints: [] as CloudProjectCheckpoint[] };
  if (checkpoints.error || project.error || !project.data)
    throw new DomainError("INTERNAL_ERROR", "作品の固定版履歴を読み込めませんでした。", { cause: checkpoints.error ?? project.error });
  const projectRevision = Number(project.data.revision);
  const productionContextRevision = Number(project.data.production_context_revision);
  const [pages, chapters, episodes, scenes, assets] = await Promise.all([
    supabase.from("cloud_pages").select("id,revision").eq("project_id", projectId).is("deleted_at", null),
    supabase.from("cloud_chapters").select("id").eq("project_id", projectId).is("deleted_at", null),
    supabase.from("cloud_episodes").select("id").eq("project_id", projectId).is("deleted_at", null),
    supabase.from("cloud_scenes").select("id").eq("project_id", projectId).is("deleted_at", null),
    supabase.from("cloud_assets").select("id").eq("project_id", projectId).is("deleted_at", null),
  ]);
  const diffAvailable = !pages.error && !chapters.error && !episodes.error && !scenes.error && !assets.error;
  const currentComparable = {
    project: {
      title: project.data.title,
      description: project.data.description ?? "",
      readingDirection: project.data.reading_direction,
      width: Number(project.data.width),
      height: Number(project.data.height),
      dpi: Number(project.data.dpi),
    },
    pages: (pages.data ?? []).map((row) => ({ id: row.id, revision: Number(row.revision) })),
    chapters: chapters.data ?? [], episodes: episodes.data ?? [], scenes: scenes.data ?? [], assets: assets.data ?? [],
  };
  const restoreAvailable = !restores.error;
  const restoreByCheckpoint = new Map<string, { revision: number; restoredAt: string }>();
  if (restoreAvailable) for (const row of restores.data ?? []) {
    if (!restoreByCheckpoint.has(row.checkpoint_id)) restoreByCheckpoint.set(row.checkpoint_id, {
      revision: Number(row.result_project_revision), restoredAt: row.restored_at,
    });
  }
  return {
    available: true,
    restoreAvailable,
    checkpoints: (checkpoints.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind as CloudProjectCheckpoint["kind"],
      label: row.label,
      projectRevision: Number(row.project_revision),
      productionContextRevision: Number(row.production_context_revision),
      pageCount: Number(row.page_count),
      manifestSha256: row.manifest_sha256,
      createdAt: row.created_at,
      lastRestoredAt: restoreByCheckpoint.get(row.id)?.restoredAt ?? null,
      diff: diffAvailable
        ? summarizeCloudCheckpointDiff(row.manifest, currentComparable)
        : { available: false, pagesToRestore: 0, pagesToRemove: 0, structureChanges: 0, assetChanges: 0, projectSettingsChanged: false, hasChanges: false },
      isCurrent: (Number(row.project_revision) === projectRevision
        && Number(row.production_context_revision) === productionContextRevision)
        || restoreByCheckpoint.get(row.id)?.revision === projectRevision,
    })),
  };
}

const checkpointCommands: ProjectCheckpointCommandRepository = {
  async restore(input) {
    const { supabase } = await cloudCreatorContext();
    const { data, error } = await supabase.rpc("restore_cloud_project_checkpoint", {
      p_project_id: input.projectId,
      p_checkpoint_id: input.checkpointId,
    });
    if (error?.code === "42883") throw new ValidationError("固定版復元用migrationを適用してください。");
    if (error?.message?.includes("generation_active")) throw new ValidationError("画像生成が完了してから復元してください。");
    if (error?.message?.includes("page_locked")) throw new ValidationError("開いているページ編集を終了してから復元してください。");
    if (error?.message?.includes("blob_missing")) throw new ValidationError("固定版データが不足しているため復元できません。");
    if (error || !data) throw new DomainError("INTERNAL_ERROR", "固定版を復元できませんでした。", { cause: error });
    return String(data);
  },
  async create(input) {
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
  },
};

export async function restoreCloudProjectCheckpoint(input: { projectId: string; checkpointId: string }) {
  return restoreProjectCheckpoint({ ...input, repository: checkpointCommands });
}

export async function createCloudProjectCheckpoint(input: { projectId: string; label: string; kind: "checkpoint" | "release" }) {
  return createProjectCheckpoint({
    ...input,
    repository: checkpointCommands,
    inspectRelease: async (projectId) => {
      const [completion, manuscript] = await Promise.all([
        assertCloudProjectComplete(projectId),
        getCloudManuscriptPreflight(projectId, { requireFinalizedPages: true }),
      ]);
      return { ready: completion.complete && manuscript.ready };
    },
  });
}
