"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireAdmin } from "@/lib/auth";
import {
  getCloudResearchAiSettings,
  setCloudResearchAiSettings,
} from "@/lib/cloud-research-ai-settings";
import { ValidationError } from "@/lib/domain-errors";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function updateCloudResearchAiAction(formData: FormData) {
  try {
    const { profile } = await requireAdmin();
    const apiKey = field(formData, "apiKey").trim();
    const current = await getCloudResearchAiSettings();
    if (
      !apiKey ||
      !apiKey.startsWith("sk-") ||
        apiKey.length < 20 ||
        apiKey.length > 500 ||
        /\s/.test(apiKey)
    )
      throw new ValidationError("OpenAI APIキーの形式を確認してください。");
    await setCloudResearchAiSettings({
      actorProfileId: profile.id,
      apiKey,
      model: current?.model ?? "gpt-5.6-terra",
      enabled: true,
    });
  } catch (error) {
    const safeMessage = safeDomainErrorMessage(
      error,
      "市場分析AI設定を更新できませんでした。",
    );
    redirect(`/admin/research-ai?error=${encodeURIComponent(safeMessage)}`);
  }
  revalidatePath("/admin/research-ai");
  redirect(`/admin/research-ai?message=${encodeURIComponent("APIキーを安全に保存しました。一般向けAIを利用できます。")}`);
}
