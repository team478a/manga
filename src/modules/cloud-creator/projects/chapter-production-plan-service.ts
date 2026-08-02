import type { CloudChapterProductionPlan } from "@/lib/cloud-chapter-production-plan";
import { DomainError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";

export async function listCloudChapterProductionPlans(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.from("cloud_chapter_production_plans")
    .select("id,project_id,chapter_id,priority,assignee_name,due_date,notes,updated_at")
    .eq("project_id", projectId).order("due_date", { nullsFirst: false });
  if (error?.code === "42P01") return { available: false, plans: [] as CloudChapterProductionPlan[] };
  if (error) throw new DomainError("INTERNAL_ERROR", "章の制作計画を読み込めませんでした。", { cause: error });
  return { available: true, plans: (data ?? []) as CloudChapterProductionPlan[] };
}

export async function saveCloudChapterProductionPlan(input: {
  projectId: string;chapterId: string;priority: string;assigneeName: string;dueDate: string | null;notes: string;
}) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("save_cloud_chapter_production_plan", {
    p_project_id: input.projectId,p_chapter_id: input.chapterId,p_priority: input.priority,
    p_assignee_name: input.assigneeName,p_due_date: input.dueDate,p_notes: input.notes,
  });
  if (error || !data) throw new DomainError("INTERNAL_ERROR", "章の制作計画を保存できませんでした。", { cause: error });
  return data as string;
}
