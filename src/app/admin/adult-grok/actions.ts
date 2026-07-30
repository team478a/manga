"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireAdmin } from "@/lib/auth";
import {
  getCloudAdultGrokSettings,
  setCloudAdultGrokSettings,
} from "@/lib/cloud-adult-grok-settings";
import { ValidationError } from "@/lib/domain-errors";

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

export async function updateCloudAdultGrokAction(formData: FormData) {
  try {
    const { profile } = await requireAdmin();
    const apiKey = field(formData, "apiKey").trim();
    const current = await getCloudAdultGrokSettings();
    if (!apiKey || apiKey.length < 20 || apiKey.length > 500 || /\s/.test(apiKey))
      throw new ValidationError("xAI APIキーの形式を確認してください。");
    await setCloudAdultGrokSettings({
      actorProfileId: profile.id,
      apiKey,
      model: current?.model ?? "grok-4.5",
      enabled: true,
    });
  } catch (error) {
    const safeMessage = safeDomainErrorMessage(
      error,
      "成人向けGrok設定を更新できませんでした。",
    );
    redirect(`/admin/adult-grok?error=${encodeURIComponent(safeMessage)}`);
  }
  revalidatePath("/admin/adult-grok");
  redirect(`/admin/adult-grok?message=${encodeURIComponent("APIキーを安全に保存しました。成人向けGrokを利用できます。")}`);
}
