"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cloudChapterProductionPlanSchema } from "@/lib/cloud-chapter-production-plan";
import { isDomainError } from "@/lib/domain-errors";
import { saveCloudChapterProductionPlan } from "@/modules/cloud-creator/projects/chapter-production-plan-service";
import { cloudProjectBudgetSchema } from "@/lib/cloud-project-budget";
import { saveCloudProjectBudget } from "@/modules/cloud-creator/projects/project-budget-service";

const value = (formData: FormData, name: string) => {
  const item = formData.get(name);return typeof item === "string" ? item : "";
};

export async function saveCloudChapterProductionPlanAction(projectId: string, chapterId: string, formData: FormData) {
  const dueDate = value(formData, "dueDate");
  const parsed = cloudChapterProductionPlanSchema.safeParse({
    projectId,chapterId,priority: value(formData, "priority"),assigneeName: value(formData, "assigneeName"),
    dueDate: dueDate || null,notes: value(formData, "notes"),
  });
  if (!parsed.success) redirect(`/creator/${projectId}/cockpit?error=${encodeURIComponent("章の制作計画を確認してください。")}`);
  try { await saveCloudChapterProductionPlan(parsed.data); }
  catch (error) { redirect(`/creator/${projectId}/cockpit?error=${encodeURIComponent(isDomainError(error) ? error.message : "章の制作計画を保存できませんでした。")}`); }
  revalidatePath(`/creator/${projectId}/cockpit`);
  redirect(`/creator/${projectId}/cockpit?message=${encodeURIComponent("章の制作計画を保存しました。")}`);
}

export async function saveCloudProjectBudgetAction(projectId: string, formData: FormData) {
  const costUsd = value(formData, "monthlyCostUsd");
  const storageMb = value(formData, "storageMb");
  const parsed = cloudProjectBudgetSchema.safeParse({
    projectId,
    monthlyCreditLimit: value(formData, "monthlyCreditLimit"),
    monthlyCostLimitMicros: costUsd ? Math.round(Number(costUsd) * 1_000_000) : null,
    storageLimitBytes: storageMb ? Math.round(Number(storageMb) * 1024 * 1024) : null,
    warningPercent: value(formData, "warningPercent"),
    generationEnabled: formData.get("generationEnabled") === "on",
  });
  if (!parsed.success) redirect(`/creator/${projectId}/cockpit?error=${encodeURIComponent("作品の生成上限を確認してください。")}`);
  try { await saveCloudProjectBudget(parsed.data); }
  catch (error) { redirect(`/creator/${projectId}/cockpit?error=${encodeURIComponent(isDomainError(error) ? error.message : "作品の生成上限を保存できませんでした。")}`); }
  revalidatePath(`/creator/${projectId}/cockpit`);
  redirect(`/creator/${projectId}/cockpit?message=${encodeURIComponent("作品の生成上限を保存しました。")}`);
}
