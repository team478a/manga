"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireAdmin } from "@/lib/auth";
import {
  cloudGeneralImageModelSchema,
  setCloudGeneralImageSettings,
} from "@/lib/cloud-general-image-settings";
import { setCloudGeneralMonitorEmailSettings } from "@/lib/cloud-general-monitor-email-settings";
import {
  cloudResearchAiModelSchema,
  setCloudResearchAiSettings,
} from "@/lib/cloud-research-ai-settings";
import { ValidationError } from "@/lib/domain-errors";
import { actionFeedbackTarget } from "@/lib/action-contracts";
import { formText } from "@/app/actions/shared/form-data";

const destination = "/admin/provider-settings";

function success(message: string) {
  revalidatePath(destination);
  redirect(actionFeedbackTarget(destination, "message", message));
}

function failure(error: unknown, fallback: string) {
  redirect(
    actionFeedbackTarget(
      destination,
      "error",
      safeDomainErrorMessage(error, fallback),
    ),
  );
}

export async function updateOpenAiProviderAction(formData: FormData) {
  try {
    const { profile } = await requireAdmin();
    const model = cloudResearchAiModelSchema.safeParse(formText(formData, "model"));
    const apiKey = formText(formData, "apiKey");
    if (!model.success) throw new ValidationError("AIモデルを確認してください。");
    if (apiKey && (!apiKey.startsWith("sk-") || apiKey.length < 20 || apiKey.length > 500))
      throw new ValidationError("OpenAI APIキーの形式を確認してください。");
    await setCloudResearchAiSettings({
      actorProfileId: profile.id,
      apiKey,
      model: model.data,
      enabled: formText(formData, "enabled") === "true",
    });
  } catch (error) {
    failure(error, "OpenAI設定を保存できませんでした。");
  }
  success("OpenAI設定を安全に保存しました。");
}

export async function updateImageProviderAction(formData: FormData) {
  try {
    const { profile } = await requireAdmin();
    const parsed = z.object({
      apiKey: z.string().max(500),
      model: cloudGeneralImageModelSchema,
      enabled: z.enum(["true", "false"]),
    }).safeParse({
      apiKey: formText(formData, "apiKey"),
      model: formText(formData, "model"),
      enabled: formText(formData, "enabled"),
    });
    if (!parsed.success) throw new ValidationError("画像生成AI設定を確認してください。");
    await setCloudGeneralImageSettings({
      actorProfileId: profile.id,
      apiKey: parsed.data.apiKey,
      model: parsed.data.model,
      enabled: parsed.data.enabled === "true",
    });
  } catch (error) {
    failure(error, "画像生成AI設定を保存できませんでした。");
  }
  success("画像生成AI設定を安全に保存しました。");
}

export async function updateResendProviderAction(formData: FormData) {
  try {
    const { profile } = await requireAdmin();
    const parsed = z.object({
      apiKey: z.string().min(20).max(500).regex(/^re_[^\s]+$/, "Resend APIキーの形式を確認してください。"),
      fromEmail: z.string().email().max(254),
      fromName: z.string().min(1).max(80),
    }).safeParse({
      apiKey: formText(formData, "apiKey"),
      fromEmail: formText(formData, "fromEmail"),
      fromName: formText(formData, "fromName"),
    });
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Resend設定を確認してください。");
    await setCloudGeneralMonitorEmailSettings({
      actorProfileId: profile.id,
      ...parsed.data,
    });
  } catch (error) {
    failure(error, "Resend設定を保存できませんでした。");
  }
  success("Resend設定を安全に保存しました。");
}
