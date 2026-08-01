import {
  evaluateNarrativeContinuity,
  type CloudContinuityFact,
  type CloudContinuityFactInput,
  type CloudPlotThread,
  type CloudPlotThreadInput,
} from "@/lib/cloud-narrative-continuity";
import { DomainError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";
import { getCloudProjectWorkspace } from "./project-service";

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
