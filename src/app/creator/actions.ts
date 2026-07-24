"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addCloudEpisode,
  addCloudPage,
  createCloudProject,
  deleteCloudStructure,
  moveCloudStructure,
  renameCloudEpisode,
  renameCloudProject,
  setCloudProjectDeleted,
  setCloudProjectCover,
} from "@/lib/cloud-creator-server";
import { syncCloudMarketplaceDraft } from "@/lib/cloud-marketplace";
import { isDomainError } from "@/lib/domain-errors";

const projectSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  ageRating: z.enum(["全年齢", "12歳以上", "15歳以上"]),
  readingDirection: z.enum(["rtl", "ltr"]),
  width: z.coerce.number().int().min(100).max(20_000),
  height: z.coerce.number().int().min(100).max(20_000),
  dpi: z.coerce.number().int().min(72).max(1200),
});

function value(formData: FormData, name: string) {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
}

function domainMessage(error: unknown, fallback: string) {
  return isDomainError(error) ? error.message : fallback;
}

export async function createCloudProjectAction(formData: FormData) {
  const parsed = projectSchema.safeParse({
    title: value(formData, "title"),
    description: value(formData, "description"),
    ageRating: value(formData, "ageRating"),
    readingDirection: value(formData, "readingDirection"),
    width: value(formData, "width"),
    height: value(formData, "height"),
    dpi: value(formData, "dpi"),
  });
  if (!parsed.success)
    redirect("/creator/new?error=Project設定を確認してください");
  let result: Awaited<ReturnType<typeof createCloudProject>>;
  try {
    result = await createCloudProject(parsed.data);
  } catch (error) {
    const message = domainMessage(error, "Projectを作成できませんでした。");
    redirect(`/creator/new?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/creator");
  redirect(`/creator/${result.project_id}?message=Projectを作成しました`);
}

export async function addCloudEpisodeAction(
  projectId: string,
  formData: FormData,
) {
  const parsed = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .safeParse(value(formData, "title"));
  if (!parsed.success)
    redirect(`/creator/${projectId}?error=Episode名を入力してください`);
  try {
    await addCloudEpisode(projectId, parsed.data);
  } catch (error) {
    const message = domainMessage(error, "Episodeを追加できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(`/creator/${projectId}?message=Episodeを追加しました`);
}

export async function addCloudPageAction(projectId: string, episodeId: string) {
  let pageId: string;
  try {
    pageId = await addCloudPage(episodeId);
  } catch (error) {
    const message = domainMessage(error, "Pageを追加できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(`/creator/${projectId}/pages/${pageId}`);
}

export async function renameCloudProjectAction(
  projectId: string,
  formData: FormData,
) {
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(200),
      description: z.string().max(5000),
    })
    .safeParse({
      title: value(formData, "title"),
      description: value(formData, "description"),
    });
  if (!parsed.success)
    redirect(`/creator/${projectId}?error=Project情報を確認してください`);
  try {
    await renameCloudProject(
      projectId,
      parsed.data.title,
      parsed.data.description,
    );
  } catch (error) {
    const message = domainMessage(error, "Projectを更新できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(`/creator/${projectId}?message=Project情報を更新しました`);
}

export async function renameCloudEpisodeAction(
  projectId: string,
  episodeId: string,
  formData: FormData,
) {
  const parsed = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .safeParse(value(formData, "title"));
  if (!parsed.success)
    redirect(`/creator/${projectId}?error=Episode名を確認してください`);
  try {
    await renameCloudEpisode(episodeId, parsed.data);
  } catch (error) {
    const message = domainMessage(error, "Episodeを更新できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(`/creator/${projectId}?message=Episode名を更新しました`);
}

export async function moveCloudStructureAction(
  projectId: string,
  kind: "episode" | "page",
  id: string,
  direction: -1 | 1,
) {
  try {
    await moveCloudStructure(kind, id, direction);
  } catch (error) {
    const message = domainMessage(error, "並び順を変更できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
}

export async function deleteCloudStructureAction(
  projectId: string,
  kind: "episode" | "page",
  id: string,
) {
  try {
    await deleteCloudStructure(kind, id);
  } catch (error) {
    const message = domainMessage(error, "削除できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(
    `/creator/${projectId}?message=${kind === "episode" ? "Episode" : "Page"}をゴミ箱へ移動しました`,
  );
}

export async function deleteCloudProjectAction(projectId: string) {
  try {
    await setCloudProjectDeleted(projectId, true);
  } catch (error) {
    const message = domainMessage(error, "Projectを削除できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/creator");
  revalidatePath("/creator/trash");
  redirect("/creator?message=Projectをゴミ箱へ移動しました");
}

export async function restoreCloudProjectAction(projectId: string) {
  try {
    await setCloudProjectDeleted(projectId, false);
  } catch (error) {
    const message = domainMessage(error, "Projectを復元できませんでした。");
    redirect(`/creator/trash?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/creator");
  revalidatePath("/creator/trash");
  redirect(`/creator/${projectId}?message=Projectを復元しました`);
}

export async function setCloudProjectCoverAction(
  projectId: string,
  pageId: string,
) {
  try {
    await setCloudProjectCover(projectId, pageId);
  } catch (error) {
    const message = domainMessage(error, "表紙を設定できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(`/creator/${projectId}?message=表紙Pageを設定しました`);
}

export async function syncCloudMarketplaceDraftAction(
  projectId: string,
  formData: FormData,
) {
  const parsed = z.coerce
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .safeParse(value(formData, "price"));
  if (!parsed.success)
    redirect(`/creator/${projectId}?error=販売価格を確認してください`);
  let result: Awaited<ReturnType<typeof syncCloudMarketplaceDraft>>;
  try {
    result = await syncCloudMarketplaceDraft({
      projectId,
      price: parsed.data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Marketplace下書きを作成できませんでした。";
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  revalidatePath("/dashboard/works");
  revalidatePath("/dashboard/products");
  redirect(
    `/creator/${projectId}?message=${encodeURIComponent("Marketplace下書きを更新しました")}&productId=${result.productId}`,
  );
}
