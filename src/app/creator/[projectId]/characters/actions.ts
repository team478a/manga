"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cloudCharacterProfileInputSchema } from "@/lib/cloud-character-profile";
import { deleteCloudCharacterProfile, saveCloudCharacterProfile } from "@/lib/cloud-creator-server";

const ids = z.object({ projectId: z.string().uuid(), profileId: z.string().uuid() });
const text = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)) : "";

export async function saveCharacterProfileAction(projectId: string, form: FormData) {
  const rawId = text(form, "profileId");
  const parsed = cloudCharacterProfileInputSchema.safeParse({
    projectId,profileId: rawId || null,name: text(form,"name"),role: text(form,"role"),
    appearanceAge: text(form,"appearanceAge"),bodyBuild: text(form,"bodyBuild"),hair: text(form,"hair"),
    costume: text(form,"costume"),colorPalette: text(form,"colorPalette"),
    immutableTraits: text(form,"immutableTraits").split("\n").map((value)=>value.trim()).filter(Boolean),
    prompt: text(form,"prompt"),negativePrompt: text(form,"negativePrompt"),
  });
  if (!parsed.success) redirect(`/creator/${projectId}/characters?error=${encodeURIComponent("入力内容を確認してください。")}`);
  await saveCloudCharacterProfile(parsed.data).catch(() => redirect(`/creator/${projectId}/characters?error=${encodeURIComponent("設定を保存できませんでした。")}`));
  revalidatePath(`/creator/${projectId}`);revalidatePath(`/creator/${projectId}/characters`);
  redirect(`/creator/${projectId}/characters?message=${encodeURIComponent("キャラクター設定を保存しました。")}`);
}

export async function deleteCharacterProfileAction(projectId: string, profileId: string) {
  const parsed = ids.safeParse({ projectId, profileId });
  if (!parsed.success) redirect(`/creator/${projectId}/characters?error=${encodeURIComponent("対象を確認できませんでした。")}`);
  await deleteCloudCharacterProfile(projectId, profileId).catch(() => redirect(`/creator/${projectId}/characters?error=${encodeURIComponent("設定を削除できませんでした。")}`));
  revalidatePath(`/creator/${projectId}`);revalidatePath(`/creator/${projectId}/characters`);
  redirect(`/creator/${projectId}/characters?message=${encodeURIComponent("キャラクター設定を削除しました。")}`);
}
