"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireAdmin } from "@/lib/auth";
import { setCloudAdultMonitorEmailTemplate } from "@/lib/cloud-general-monitor-email-settings";
import { ValidationError } from "@/lib/domain-errors";

const allowed = new Set([
  "recipient_name",
  "welcome_url",
  "expires_on",
  "ai_request_limit",
]);
const schema = z.object({
  subjectTemplate: z.string().trim().min(1).max(120)
    .refine((value) => !/[\r\n]/.test(value), "件名に改行は使用できません。"),
  bodyTemplate: z.string().trim().min(20).max(5000)
    .refine((value) => value.includes("{{welcome_url}}"), "利用開始URLが必要です。"),
}).superRefine(({ subjectTemplate, bodyTemplate }, context) => {
  for (const match of `${subjectTemplate}\n${bodyTemplate}`.matchAll(/\{\{([a-z_]+)\}\}/g))
    if (!allowed.has(match[1] ?? ""))
      context.addIssue({ code: "custom", message: `利用できない差し込み項目です: ${match[0]}` });
});

export async function updateAdultMonitorEmailTemplateAction(formData: FormData) {
  try {
    const { profile } = await requireAdmin();
    const parsed = schema.safeParse({
      subjectTemplate: formData.get("subjectTemplate"),
      bodyTemplate: formData.get("bodyTemplate"),
    });
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "文面を確認してください。");
    await setCloudAdultMonitorEmailTemplate({
      actorProfileId: profile.id,
      ...parsed.data,
    });
  } catch (error) {
    redirect(`/admin/adult-monitors/email?error=${encodeURIComponent(
      safeDomainErrorMessage(error, "成人向け招待メールの文面を保存できませんでした。"),
    )}`);
  }
  revalidatePath("/admin/adult-monitors/email");
  redirect("/admin/adult-monitors/email?message=成人向け招待メールの文面を保存しました");
}
