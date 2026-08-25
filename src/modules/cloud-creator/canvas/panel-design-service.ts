import {
  cloudPanelDesignSaveSchema,
  cloudPanelDesignSchema,
  emptyCloudPanelDesign,
  type CloudPanelDesign,
  type CloudPanelDesignRecord,
} from "@/lib/cloud-panel-design";
import { DomainError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";
import { getCloudProjectWorkspace } from "../projects/project-service";

type Row = { id: string; panel_id: string; revision: number; design: unknown; updated_at: string };

export async function listCloudPanelDesigns(projectId: string, pageId: string) {
  const { supabase } = await cloudCreatorContext();
  const workspace = await getCloudProjectWorkspace(projectId);
  if (!workspace.pages.some((page) => page.id === pageId))
    throw new DomainError("RESOURCE_NOT_FOUND", "ページが見つかりません。");
  const result = await supabase.from("cloud_panel_designs")
    .select("id,panel_id,revision,design,updated_at").eq("project_id", projectId)
    .eq("page_id", pageId).order("updated_at", { ascending: false });
  if (result.error?.code === "42P01")
    return { available: false, designs: [] as CloudPanelDesignRecord[] };
  if (result.error)
    throw new DomainError("INTERNAL_ERROR", "コマ設計を読み込めませんでした。", { cause: result.error });
  return { available: true, designs: ((result.data as Row[]) ?? []).map((row) => ({
    id: row.id, panelId: row.panel_id, revision: Number(row.revision),
    design: cloudPanelDesignSchema.parse(row.design), updatedAt: row.updated_at,
  })) };
}

export async function materializeCloudPanelDesign(
  projectId: string, pageId: string, panelId: string, orderIndex: number,
): Promise<CloudPanelDesign> {
  const { supabase } = await cloudCreatorContext();
  const workspace = await getCloudProjectWorkspace(projectId);
  const page = workspace.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new DomainError("RESOURCE_NOT_FOUND", "ページが見つかりません。");
  const design = emptyCloudPanelDesign(orderIndex);
  const [assignments, continuity, stateAssignments, versions, worldProfiles, specifications] = await Promise.all([
    supabase.from("cloud_panel_subject_assignments").select("subject_kind,subject_id")
      .eq("project_id", projectId).eq("page_id", pageId).eq("panel_id", panelId),
    supabase.from("cloud_panel_continuity_states")
      .select("subject_kind,subject_id,time_of_day,weather,state_note,holding_hand,screen_side,gaze_direction")
      .eq("project_id", projectId).eq("page_id", pageId).eq("panel_id", panelId),
    supabase.from("cloud_character_state_assignments")
      .select("character_profile_id,character_version_id,start_page,end_page,priority")
      .eq("project_id", projectId).lte("start_page", page.page_number)
      .gte("end_page", page.page_number).order("priority", { ascending: false }),
    supabase.from("cloud_character_profile_versions").select("id,version_number").eq("project_id", projectId),
    supabase.from("cloud_world_profiles").select("id,current_version").eq("project_id", projectId),
    supabase.from("cloud_manga_panel_specifications").select("specification,created_at")
      .eq("project_id", projectId).eq("panel_id", panelId).order("created_at", { ascending: false }).limit(1),
  ]);
  for (const result of [assignments, continuity, stateAssignments, versions, worldProfiles, specifications])
    if (result.error && result.error.code !== "42P01")
      throw new DomainError("INTERNAL_ERROR", "コマ設計の素材を読み込めませんでした。", { cause: result.error });
  const state = new Map((continuity.data ?? []).map((value) => [`${value.subject_kind}:${value.subject_id}`, value]));
  const versionNumber = new Map((versions.data ?? []).map((value) => [value.id, value.version_number]));
  const worldVersion = new Map((worldProfiles.data ?? []).map((value) => [value.id, value.current_version]));
  const characterVersion = new Map<string, number>();
  for (const value of stateAssignments.data ?? []) {
    const resolved = versionNumber.get(value.character_version_id);
    if (resolved && !characterVersion.has(value.character_profile_id))
      characterVersion.set(value.character_profile_id, resolved);
  }
  for (const value of assignments.data ?? []) {
    const current = state.get(`${value.subject_kind}:${value.subject_id}`);
    if (value.subject_kind === "character" && characterVersion.has(value.subject_id))
      design.characters.push({ profileId: value.subject_id, version: characterVersion.get(value.subject_id)!, action: "", expression: "", pose: "", gaze: current?.gaze_direction ?? "", position: current?.screen_side ?? "" });
    else if (value.subject_kind === "location") {
      design.location.profileId = value.subject_id;
      design.location.timeOfDay = current?.time_of_day ?? "";
      design.location.weather = current?.weather ?? "";
    } else if (value.subject_kind === "prop" && worldVersion.has(value.subject_id))
      design.props.push({ profileId: value.subject_id, version: worldVersion.get(value.subject_id)!, holdingHand: current?.holding_hand ?? "unspecified", screenSide: current?.screen_side ?? "unspecified" });
    if (current?.state_note)
      design.continuityNote = [design.continuityNote, current.state_note].filter(Boolean).join("\n");
  }
  const specification = specifications.data?.[0]?.specification as Record<string, unknown> | undefined;
  if (specification) {
    design.promptDirection = typeof specification.visualDirection === "string" ? specification.visualDirection : "";
    design.camera.composition = typeof specification.composition === "string" ? specification.composition : "";
  }
  return cloudPanelDesignSchema.parse(design);
}

export async function saveCloudPanelDesign(input: unknown) {
  const value = cloudPanelDesignSaveSchema.parse(input);
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("save_cloud_panel_design", {
    p_project_id: value.projectId, p_page_id: value.pageId, p_panel_id: value.panelId,
    p_expected_revision: value.expectedRevision, p_design: value.design,
  });
  if (result.error) {
    const conflict = result.error.message.includes("revision_conflict");
    throw new DomainError(conflict ? "REVISION_CONFLICT" : "INTERNAL_ERROR", conflict
      ? "コマ設計が別の画面で更新されました。再読み込みしてください。"
      : "コマ設計を保存できませんでした。", { cause: result.error });
  }
  return (result.data as Array<{ panel_design_id: string; revision: number }>)[0];
}
