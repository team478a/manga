"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireAdmin } from "@/lib/auth";
import {
  cloudResearchAiModelSchema,
  setCloudResearchAiSettings,
} from "@/lib/cloud-research-ai-settings";
import { ValidationError } from "@/lib/domain-errors";
import { formString } from "@/app/actions/shared/form-data";

export async function updateCloudResearchAiAction(formData: FormData) {
  let message = "市場分析AI設定を更新しました。";
  try {
    const { profile } = await requireAdmin();
    const parsed = cloudResearchAiModelSchema.safeParse(
      formString(formData, "model"),
    );
    const apiKey = formString(formData, "apiKey").trim();
    const enabled = formString(formData, "enabled") === "true";
    if (!parsed.success)
      throw new ValidationError("AIモデルを確認してください。");
    if (
      apiKey &&
      (!apiKey.startsWith("sk-") ||
        apiKey.length < 20 ||
        apiKey.length > 500)
    )
      throw new ValidationError("OpenAI APIキーの形式を確認してください。");
    await setCloudResearchAiSettings({
      actorProfileId: profile.id,
      apiKey,
      model: parsed.data,
      enabled,
    });
    message = apiKey
      ? "APIキーを安全に保存し、市場分析AI設定を更新しました。"
      : message;
  } catch (error) {
    const safeMessage = safeDomainErrorMessage(
      error,
      "市場分析AI設定を更新できませんでした。",
    );
    redirect(`/admin/research-ai?error=${encodeURIComponent(safeMessage)}`);
  }
  revalidatePath("/admin/research-ai");
  redirect(`/admin/research-ai?message=${encodeURIComponent(message)}`);
}
