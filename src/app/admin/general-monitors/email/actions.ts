"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireAdmin } from "@/lib/auth";
import {
  setCloudGeneralMonitorEmailSettings,
  setCloudGeneralMonitorEmailTemplate,
} from "@/lib/cloud-general-monitor-email-settings";
import { ValidationError } from "@/lib/domain-errors";

const emailSettingsSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20)
    .max(500)
    .regex(/^re_[^\s]+$/, "Resend APIキーの形式を確認してください。"),
  fromEmail: z.string().trim().email().max(254),
  fromName: z.string().trim().min(1).max(80),
});

const allowedTemplatePlaceholders = new Set([
  "recipient_name",
  "welcome_url",
  "expires_on",
  "ai_request_limit",
]);

const emailTemplateSchema = z
  .object({
    subjectTemplate: z
      .string()
      .trim()
      .min(1, "件名を入力してください。")
      .max(120, "件名は120文字以内で入力してください。")
      .refine(
        (value) => !/[\r\n]/.test(value),
        "件名に改行は使用できません。",
      ),
    bodyTemplate: z
      .string()
      .trim()
      .min(20, "本文は20文字以上で入力してください。")
      .max(5000, "本文は5000文字以内で入力してください。")
      .refine(
        (value) => value.includes("{{welcome_url}}"),
        "本文には利用開始URL（{{welcome_url}}）が必要です。",
      ),
  })
  .superRefine(({ subjectTemplate, bodyTemplate }, context) => {
    const placeholders = `${subjectTemplate}\n${bodyTemplate}`.matchAll(
      /\{\{([a-z_]+)\}\}/g,
    );
    for (const match of placeholders) {
      if (!allowedTemplatePlaceholders.has(match[1] ?? "")) {
        context.addIssue({
          code: "custom",
          message: `利用できない差し込み項目があります: ${match[0]}`,
        });
      }
    }
  });

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function updateGeneralMonitorEmailSettingsAction(
  formData: FormData,
) {
  try {
    const { profile } = await requireAdmin();
    const parsed = emailSettingsSchema.safeParse({
      apiKey: field(formData, "apiKey"),
      fromEmail: field(formData, "fromEmail"),
      fromName: field(formData, "fromName"),
    });
    if (!parsed.success)
      throw new ValidationError(
        parsed.error.issues[0]?.message ??
          "APIキーと送信元情報を確認してください。",
      );
    await setCloudGeneralMonitorEmailSettings({
      actorProfileId: profile.id,
      ...parsed.data,
    });
  } catch (error) {
    redirect(
      `/admin/general-monitors/email?error=${encodeURIComponent(
        safeDomainErrorMessage(error, "招待メール設定を保存できませんでした。"),
      )}`,
    );
  }
  revalidatePath("/admin/general-monitors/email");
  redirect(
    `/admin/general-monitors/email?message=${encodeURIComponent(
      "APIキーを安全に保存しました。招待メールを利用できます。",
    )}`,
  );
}

export async function updateGeneralMonitorEmailTemplateAction(
  formData: FormData,
) {
  try {
    const { profile } = await requireAdmin();
    const parsed = emailTemplateSchema.safeParse({
      subjectTemplate: field(formData, "subjectTemplate"),
      bodyTemplate: field(formData, "bodyTemplate"),
    });
    if (!parsed.success)
      throw new ValidationError(
        parsed.error.issues[0]?.message ??
          "招待メールの件名と本文を確認してください。",
      );
    await setCloudGeneralMonitorEmailTemplate({
      actorProfileId: profile.id,
      ...parsed.data,
    });
  } catch (error) {
    redirect(
      `/admin/general-monitors/email?error=${encodeURIComponent(
        safeDomainErrorMessage(error, "招待メールの文面を保存できませんでした。"),
      )}`,
    );
  }
  revalidatePath("/admin/general-monitors/email");
  redirect(
    `/admin/general-monitors/email?message=${encodeURIComponent(
      "招待メールの件名と本文を保存しました。",
    )}`,
  );
}
