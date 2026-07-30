"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireAdmin } from "@/lib/auth";
import {
  cloudAdultGrokModelSchema,
  setCloudAdultGrokSettings,
} from "@/lib/cloud-adult-grok-settings";
import { ValidationError } from "@/lib/domain-errors";

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

export async function updateCloudAdultGrokAction(formData: FormData) {
  let message = "成人向けGrok設定を更新しました。";
  try {
    const { profile } = await requireAdmin();
    const model = cloudAdultGrokModelSchema.safeParse(field(formData, "model"));
    const apiKey = field(formData, "apiKey").trim();
    const enabled = field(formData, "enabled") === "true";
    if (!model.success) throw new ValidationError("Grokモデルを確認してください。");
    if (apiKey && (apiKey.length < 20 || apiKey.length > 500 || /\s/.test(apiKey)))
      throw new ValidationError("xAI APIキーの形式を確認してください。");
    await setCloudAdultGrokSettings({
      actorProfileId: profile.id,
      apiKey,
      model: model.data,
      enabled,
    });
    if (apiKey) message = "xAI APIキーを安全に保存し、成人向けGrok設定を更新しました。";
  } catch (error) {
    const safeMessage = safeDomainErrorMessage(
      error,
      "成人向けGrok設定を更新できませんでした。",
    );
    redirect(`/admin/adult-grok?error=${encodeURIComponent(safeMessage)}`);
  }
  revalidatePath("/admin/adult-grok");
  redirect(`/admin/adult-grok?message=${encodeURIComponent(message)}`);
}
