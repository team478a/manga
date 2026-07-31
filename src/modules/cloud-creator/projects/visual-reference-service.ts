import type {
  CloudPanelSubjectAssignment,
  CloudPanelSubjectAssignmentInput,
  CloudVisualReference,
  CloudVisualReferenceInput,
} from "@/lib/cloud-visual-references";
import { DomainError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";
import { createCloudAssetSignedUrl } from "../assets/asset-service";
import { getCloudProjectWorkspace } from "./project-service";

export async function getCloudVisualReferenceWorkspace(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  await getCloudProjectWorkspace(projectId);
  const [references, assignments] = await Promise.all([
    supabase
      .from("cloud_visual_reference_assets")
      .select("id,project_id,subject_kind,subject_id,asset_id,label,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("cloud_panel_subject_assignments")
      .select("id,project_id,page_id,panel_id,subject_kind,subject_id,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);
  if (references.error?.code === "42P01" || assignments.error?.code === "42P01")
    return {
      available: false,
      references: [] as CloudVisualReference[],
      assignments: [] as CloudPanelSubjectAssignment[],
    };
  if (references.error || assignments.error)
    throw new DomainError("INTERNAL_ERROR", "参照画像設定を読み込めませんでした。", {
      cause: references.error ?? assignments.error,
    });
  const signed = await Promise.all(
    (references.data ?? []).map(async (reference) => ({
      ...reference,
      url: await createCloudAssetSignedUrl(reference.asset_id),
    })),
  );
  return {
    available: true,
    references: signed as CloudVisualReference[],
    assignments: (assignments.data ?? []) as CloudPanelSubjectAssignment[],
  };
}

export async function saveCloudVisualReference(input: CloudVisualReferenceInput) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("save_cloud_visual_reference", {
    p_project_id: input.projectId,
    p_subject_kind: input.subjectKind,
    p_subject_id: input.subjectId,
    p_asset_id: input.assetId,
    p_label: input.label,
  });
  if (error || !data)
    throw new DomainError("INTERNAL_ERROR", "参照画像を保存できませんでした。", {
      cause: error,
    });
  return data as string;
}

export async function deleteCloudVisualReference(projectId: string, referenceId: string) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc("delete_cloud_visual_reference", {
    p_project_id: projectId,
    p_reference_id: referenceId,
  });
  if (error)
    throw new DomainError("INTERNAL_ERROR", "参照画像を解除できませんでした。", {
      cause: error,
    });
}

export async function saveCloudPanelSubjectAssignment(
  input: CloudPanelSubjectAssignmentInput,
) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("save_cloud_panel_subject_assignment", {
    p_project_id: input.projectId,
    p_page_id: input.pageId,
    p_panel_id: input.panelId,
    p_subject_kind: input.subjectKind,
    p_subject_id: input.subjectId,
  });
  if (error || !data)
    throw new DomainError("INTERNAL_ERROR", "コマへの割当を保存できませんでした。", {
      cause: error,
    });
  return data as string;
}

export async function deleteCloudPanelSubjectAssignment(
  projectId: string,
  assignmentId: string,
) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc("delete_cloud_panel_subject_assignment", {
    p_project_id: projectId,
    p_assignment_id: assignmentId,
  });
  if (error)
    throw new DomainError("INTERNAL_ERROR", "コマへの割当を解除できませんでした。", {
      cause: error,
    });
}
