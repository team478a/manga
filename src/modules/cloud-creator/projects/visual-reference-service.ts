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
import type { CharacterReferenceBindingInput, CharacterStateAssignmentInput } from "@/lib/cloud-character-reference-settings";

export async function getCloudVisualReferenceWorkspace(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  await getCloudProjectWorkspace(projectId);
  const [references, assignments, bindings, states, policy, versions] = await Promise.all([
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
    supabase.from("cloud_character_reference_bindings").select("id,character_profile_id,character_version_id,asset_id,reference_role,expression_key,priority,review_status").eq("project_id",projectId).order("priority",{ascending:false}),
    supabase.from("cloud_character_state_assignments").select("id,character_profile_id,character_version_id,start_page,end_page,scene_key,assignment_label,costume_override,state_note,priority").eq("project_id",projectId).order("start_page"),
    supabase.from("cloud_project_generation_readiness_policies").select("major_character_reference_policy").eq("project_id",projectId).maybeSingle(),
    supabase.from("cloud_character_profile_versions").select("id,profile_id,version_number").eq("project_id",projectId),
  ]);
  if (references.error?.code === "42P01" || assignments.error?.code === "42P01")
    return {
      available: false,
      references: [] as CloudVisualReference[],
      assignments: [] as CloudPanelSubjectAssignment[],
      p1Available: false,characterVersions: [],bindings: [],stateAssignments: [],readinessPolicy: "block" as const,
    };
  if (references.error || assignments.error)
    throw new DomainError("INTERNAL_ERROR", "参照画像設定を読み込めませんでした。", {
      cause: references.error ?? assignments.error,
    });
  const p1Unavailable=[bindings.error,states.error,policy.error,versions.error].some(error=>error?.code==="42P01");
  if (!p1Unavailable && (bindings.error || states.error || (policy.error && policy.error.code!=="PGRST116") || versions.error))
    throw new DomainError("INTERNAL_ERROR","人物参照の版設定を読み込めませんでした。",{cause:bindings.error??states.error??policy.error??versions.error});
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
    p1Available: !p1Unavailable,
    characterVersions: versions.data ?? [],bindings: bindings.data ?? [],stateAssignments: states.data ?? [],
    readinessPolicy: policy.data?.major_character_reference_policy === "warn" ? "warn" as const : "block" as const,
  };
}

export async function saveCloudCharacterReferenceBinding(input:CharacterReferenceBindingInput){const{supabase}=await cloudCreatorContext();const result=await supabase.rpc("save_cloud_character_reference_binding",{p_project_id:input.projectId,p_character_profile_id:input.characterProfileId,p_character_version_id:input.characterVersionId,p_asset_id:input.assetId,p_reference_role:input.role,p_expression_key:input.expressionKey||null,p_priority:input.priority,p_review_status:input.reviewStatus});if(result.error)throw new DomainError("INTERNAL_ERROR","人物参照の版設定を保存できませんでした。",{cause:result.error});}
export async function deleteCloudCharacterReferenceBinding(projectId:string,bindingId:string){const{supabase}=await cloudCreatorContext();const result=await supabase.rpc("delete_cloud_character_reference_binding",{p_project_id:projectId,p_binding_id:bindingId});if(result.error)throw new DomainError("INTERNAL_ERROR","人物参照の版設定を解除できませんでした。",{cause:result.error});}
export async function saveCloudCharacterStateAssignment(input:CharacterStateAssignmentInput){const{supabase}=await cloudCreatorContext();const result=await supabase.rpc("save_cloud_character_state_assignment",{p_project_id:input.projectId,p_character_profile_id:input.characterProfileId,p_character_version_id:input.characterVersionId,p_start_page:input.startPage,p_end_page:input.endPage,p_scene_key:input.sceneKey,p_assignment_label:input.label,p_costume_override:input.costumeOverride,p_state_note:input.stateNote,p_priority:input.priority});if(result.error)throw new DomainError("INTERNAL_ERROR","衣装・状態の適用範囲を保存できませんでした。",{cause:result.error});}
export async function deleteCloudCharacterStateAssignment(projectId:string,assignmentId:string){const{supabase}=await cloudCreatorContext();const result=await supabase.rpc("delete_cloud_character_state_assignment",{p_project_id:projectId,p_assignment_id:assignmentId});if(result.error)throw new DomainError("INTERNAL_ERROR","衣装・状態の適用範囲を解除できませんでした。",{cause:result.error});}
export async function saveCloudGenerationReadinessPolicy(projectId:string,policy:"warn"|"block"){const{supabase}=await cloudCreatorContext();const result=await supabase.rpc("save_cloud_project_generation_readiness_policy",{p_project_id:projectId,p_major_character_reference_policy:policy});if(result.error)throw new DomainError("INTERNAL_ERROR","参照画像不足時の方針を保存できませんでした。",{cause:result.error});}

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
