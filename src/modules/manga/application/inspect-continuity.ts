import {
  evaluateNarrativeContinuity,
  type CloudContinuityFact,
  type CloudContinuityFactInput,
  type CloudPlotThread,
  type CloudPlotThreadInput,
} from "@/lib/cloud-narrative-continuity";
import { DomainError } from "@/lib/domain-errors";
import { buildCloudContinuitySuggestions } from "@/lib/cloud-continuity-suggestions";
import type { CloudCharacterProfile } from "@/lib/cloud-character-profile";
import type { CloudWorldProfile } from "@/lib/cloud-world-bible";
import { cloudCreatorContext } from "@/modules/cloud-creator/auth-context";
import { getCloudProjectWorkspace } from "@/modules/cloud-creator/projects/project-service";

export async function getCloudNarrativeContinuity(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const workspace = await getCloudProjectWorkspace(projectId);
  const [facts, threads] = await Promise.all([
    supabase.from("cloud_continuity_facts").select("id,project_id,fact_kind,subject,attribute,fact_value,start_page,end_page,source_page,notes,updated_at").eq("project_id", projectId).order("start_page"),
    supabase.from("cloud_plot_threads").select("id,project_id,title,setup_page,target_payoff_page,payoff_page,status,notes,updated_at").eq("project_id", projectId).order("setup_page"),
  ]);
  if (facts.error?.code === "42P01" || threads.error?.code === "42P01")
    return { available: false, facts: [] as CloudContinuityFact[], threads: [] as CloudPlotThread[], review: evaluateNarrativeContinuity([], [], workspace.pages.length) };
  if (facts.error || threads.error)
    throw new DomainError("INTERNAL_ERROR", "物語の一貫性情報を読み込めませんでした。", { cause: facts.error ?? threads.error });
  const factRows = (facts.data ?? []) as CloudContinuityFact[];
  const threadRows = (threads.data ?? []) as CloudPlotThread[];
  return { available: true, facts: factRows, threads: threadRows, review: evaluateNarrativeContinuity(factRows, threadRows, workspace.pages.length) };
}
export async function getCloudContinuitySuggestions(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const workspace = await getCloudProjectWorkspace(projectId);
  const [characters, worlds, facts] = await Promise.all([
    supabase.from("cloud_character_profiles")
      .select("id,project_id,name,role,current_version,updated_at")
      .eq("project_id", projectId).is("deleted_at", null),
    supabase.from("cloud_world_profiles")
      .select("id,project_id,kind,name,current_version,updated_at")
      .eq("project_id", projectId).is("deleted_at", null),
    supabase.from("cloud_continuity_facts")
      .select("id,project_id,fact_kind,subject,attribute,fact_value,start_page,end_page,source_page,notes,updated_at")
      .eq("project_id", projectId),
  ]);
  if ([characters, worlds, facts].some((result) => result.error?.code === "42P01"))
    return { available: false, suggestions: [] };
  const failure = [characters, worlds, facts].find((result) => result.error);
  if (failure?.error)
    throw new DomainError("INTERNAL_ERROR", "設定候補を読み込めませんでした。", { cause: failure.error });
  const characterIds = (characters.data ?? []).map((profile) => profile.id);
  const worldIds = (worlds.data ?? []).map((profile) => profile.id);
  const [characterVersions, worldVersions] = await Promise.all([
    characterIds.length ? supabase.from("cloud_character_profile_versions")
      .select("profile_id,version_number,appearance_age,body_build,hair,costume,color_palette,immutable_traits,prompt,negative_prompt")
      .in("profile_id", characterIds) : Promise.resolve({ data: [], error: null }),
    worldIds.length ? supabase.from("cloud_world_profile_versions")
      .select("profile_id,version_number,description,visual_traits,color_palette,continuity_rules,prompt,negative_prompt")
      .in("profile_id", worldIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (characterVersions.error || worldVersions.error)
    throw new DomainError("INTERNAL_ERROR", "設定候補を読み込めませんでした。", { cause: characterVersions.error ?? worldVersions.error });
  const characterProfiles = (characters.data ?? []).flatMap((profile) => {
    const version = (characterVersions.data ?? []).find((item) => item.profile_id === profile.id && item.version_number === profile.current_version);
    return version ? [{ ...profile, ...version } as CloudCharacterProfile] : [];
  });
  const worldProfiles = (worlds.data ?? []).flatMap((profile) => {
    const version = (worldVersions.data ?? []).find((item) => item.profile_id === profile.id && item.version_number === profile.current_version);
    return version ? [{ ...profile, ...version } as CloudWorldProfile] : [];
  });
  return {
    available: true,
    suggestions: buildCloudContinuitySuggestions({
      projectId,
      pages: workspace.pages,
      longform: workspace.longform,
      characters: characterProfiles,
      worlds: worldProfiles,
      existingFacts: (facts.data ?? []) as CloudContinuityFact[],
    }),
  };
}

export async function saveCloudContinuityFact(input: CloudContinuityFactInput) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("save_cloud_continuity_fact", {
    p_project_id: input.projectId,p_fact_id: input.factId,p_fact_kind: input.factKind,p_subject: input.subject,
    p_attribute: input.attribute,p_fact_value: input.factValue,p_start_page: input.startPage,p_end_page: input.endPage,
    p_source_page: input.sourcePage,p_notes: input.notes,
  });
  if (error || !data) throw new DomainError("INTERNAL_ERROR", "連続性の事実を保存できませんでした。", { cause: error });
  return data as string;
}

export async function deleteCloudContinuityFact(projectId: string, factId: string) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc("delete_cloud_continuity_fact", { p_project_id: projectId, p_fact_id: factId });
  if (error) throw new DomainError("INTERNAL_ERROR", "連続性の事実を削除できませんでした。", { cause: error });
}

export async function saveCloudPlotThread(input: CloudPlotThreadInput) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("save_cloud_plot_thread", {
    p_project_id: input.projectId,p_thread_id: input.threadId,p_title: input.title,p_setup_page: input.setupPage,
    p_target_payoff_page: input.targetPayoffPage,p_payoff_page: input.payoffPage,p_status: input.status,p_notes: input.notes,
  });
  if (error || !data) throw new DomainError("INTERNAL_ERROR", "伏線を保存できませんでした。", { cause: error });
  return data as string;
}

export async function deleteCloudPlotThread(projectId: string, threadId: string) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc("delete_cloud_plot_thread", { p_project_id: projectId, p_thread_id: threadId });
  if (error) throw new DomainError("INTERNAL_ERROR", "伏線を削除できませんでした。", { cause: error });
}
