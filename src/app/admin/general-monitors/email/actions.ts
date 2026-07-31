"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireAdmin } from "@/lib/auth";
import { setCloudGeneralMonitorEmailSettings } from "@/lib/cloud-general-monitor-email-settings";
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
