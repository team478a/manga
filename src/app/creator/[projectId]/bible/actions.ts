"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  cloudStyleBibleInputSchema,
  cloudWorldProfileInputSchema,
} from "@/lib/cloud-world-bible";
import {
  deleteCloudWorldProfile,
  saveCloudStyleBible,
  saveCloudWorldProfile,
} from "@/lib/cloud-creator-server";

const text = (form: FormData, key: string) =>
  typeof form.get(key) === "string" ? String(form.get(key)) : "";
const lines = (form: FormData, key: string) =>
  text(form, key).split("\n").map((value) => value.trim()).filter(Boolean);
const url = (projectId: string, key: "message" | "error", value: string) =>
  `/creator/${projectId}/bible?${key}=${encodeURIComponent(value)}`;

export async function saveStyleBibleAction(projectId: string, form: FormData) {
  const parsed = cloudStyleBibleInputSchema.safeParse({
    projectId,
    artStyle: text(form, "artStyle"),
    linework: text(form, "linework"),
    shading: text(form, "shading"),
    backgroundDetail: text(form, "backgroundDetail"),
    compositionRules: text(form, "compositionRules"),
    negativePrompt: text(form, "negativePrompt"),
  });
  if (!parsed.success) redirect(url(projectId, "error", "画風設定の入力内容を確認してください。"));
  await saveCloudStyleBible(parsed.data).catch(() =>
    redirect(url(projectId, "error", "画風設定を保存できませんでした。")),
  );
  revalidatePath(`/creator/${projectId}/bible`);
  redirect(url(projectId, "message", "画風設定を新しい版として保存しました。"));
}

export async function saveWorldProfileAction(projectId: string, form: FormData) {
  const rawId = text(form, "profileId");
  const parsed = cloudWorldProfileInputSchema.safeParse({
    projectId,
    profileId: rawId || null,
    kind: text(form, "kind"),
    name: text(form, "name"),
    description: text(form, "description"),
    visualTraits: lines(form, "visualTraits"),
    colorPalette: text(form, "colorPalette"),
    continuityRules: lines(form, "continuityRules"),
    prompt: text(form, "prompt"),
    negativePrompt: text(form, "negativePrompt"),
  });
  if (!parsed.success) redirect(url(projectId, "error", "場所・小物設定の入力内容を確認してください。"));
  await saveCloudWorldProfile(parsed.data).catch(() =>
    redirect(url(projectId, "error", "場所・小物設定を保存できませんでした。")),
  );
  revalidatePath(`/creator/${projectId}/bible`);
  redirect(url(projectId, "message", "場所・小物設定を保存しました。"));
}

export async function deleteWorldProfileAction(projectId: string, profileId: string) {
  const parsed = z.object({ projectId: z.string().uuid(), profileId: z.string().uuid() })
    .safeParse({ projectId, profileId });
  if (!parsed.success) redirect(url(projectId, "error", "対象を確認できませんでした。"));
  await deleteCloudWorldProfile(projectId, profileId).catch(() =>
    redirect(url(projectId, "error", "場所・小物設定を削除できませんでした。")),
  );
  revalidatePath(`/creator/${projectId}/bible`);
  redirect(url(projectId, "message", "場所・小物設定を削除しました。"));
}
