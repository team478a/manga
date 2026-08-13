"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addCloudChapter,
  addCloudEpisode,
  addCloudEpisodeToChapter,
  addCloudPage,
  addCloudPageToScene,
  addCloudScene,
  createCloudProject,
  createCloudProjectCheckpoint,
  deleteCloudStructure,
  moveCloudPageBefore,
  moveCloudStructure,
  renameCloudEpisode,
  renameCloudProject,
  restoreCloudProjectCheckpoint,
  setCloudProjectDeleted,
  setCloudProjectCover,
  setCloudPageProductionStatus,
  retryFailedCloudGenerationJob,
  setCloudGenerationBatchState,
  startCloudPageGenerationBatch,
} from "@/lib/cloud-creator-server";
import { createCloudExportJob, setCloudExportJobState } from "@/modules/cloud-creator/export/durable-export-service";
import { syncCloudMarketplaceDraft } from "@/lib/cloud-marketplace";
import { isDomainError } from "@/lib/domain-errors";
import { formString } from "@/app/actions/shared/form-data";

const projectSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  ageRating: z.enum(["全年齢", "12歳以上", "15歳以上"]),
  readingDirection: z.enum(["rtl", "ltr"]),
  width: z.coerce.number().int().min(100).max(20_000),
  height: z.coerce.number().int().min(100).max(20_000),
  dpi: z.coerce.number().int().min(72).max(1200),
});

function domainMessage(error: unknown, fallback: string) {
  return isDomainError(error) ? error.message : fallback;
}

export async function createCloudProjectAction(formData: FormData) {
  const parsed = projectSchema.safeParse({
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    ageRating: formString(formData, "ageRating"),
    readingDirection: formString(formData, "readingDirection"),
    width: formString(formData, "width"),
    height: formString(formData, "height"),
    dpi: formString(formData, "dpi"),
  });
  if (!parsed.success)
    redirect(encodeURI("/creator/new?error=作品設定を確認してください"));
  let result: Awaited<ReturnType<typeof createCloudProject>>;
  try {
    result = await createCloudProject(parsed.data);
  } catch (error) {
    const message = domainMessage(error, "作品を作成できませんでした。");
    redirect(`/creator/new?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/creator");
  redirect(encodeURI(`/creator/${result.project_id}?message=作品を作成しました`));
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
    .safeParse(formString(formData, "title"));
  if (!parsed.success)
    redirect(encodeURI(`/creator/${projectId}?error=話の名前を入力してください`));
  try {
    await addCloudEpisode(projectId, parsed.data);
  } catch (error) {
    const message = domainMessage(error, "話を追加できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(encodeURI(`/creator/${projectId}?message=話を追加しました`));
}

export async function addCloudPageAction(projectId: string, episodeId: string) {
  let pageId: string;
  try {
    pageId = await addCloudPage(episodeId);
  } catch (error) {
    const message = domainMessage(error, "ページを追加できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(`/creator/${projectId}/pages/${pageId}`);
}

export async function addCloudChapterAction(
  projectId: string,
  formData: FormData,
) {
  const parsed = z.string().trim().min(1).max(200).safeParse(formString(formData, "title"));
  if (!parsed.success) redirect(encodeURI(`/creator/${projectId}?error=章の名前を入力してください`));
  try {
    await addCloudChapter(projectId, parsed.data);
  } catch (error) {
    redirect(`/creator/${projectId}?error=${encodeURIComponent(domainMessage(error, "章を追加できませんでした。"))}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(encodeURI(`/creator/${projectId}?message=章を追加しました`));
}

export async function addCloudEpisodeToChapterAction(
  projectId: string,
  chapterId: string,
  formData: FormData,
) {
  const parsed = z.string().trim().min(1).max(200).safeParse(formString(formData, "title"));
  if (!parsed.success) redirect(encodeURI(`/creator/${projectId}?error=話の名前を入力してください`));
  try {
    await addCloudEpisodeToChapter(chapterId, parsed.data);
  } catch (error) {
    redirect(`/creator/${projectId}?error=${encodeURIComponent(domainMessage(error, "話を追加できませんでした。"))}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(encodeURI(`/creator/${projectId}?message=話を追加しました`));
}

export async function addCloudSceneAction(
  projectId: string,
  episodeId: string,
  formData: FormData,
) {
  const parsed = z.object({
    title: z.string().trim().min(1).max(200),
    summary: z.string().max(2000),
  }).safeParse({ title: formString(formData, "title"), summary: formString(formData, "summary") });
  if (!parsed.success) redirect(encodeURI(`/creator/${projectId}?error=シーン設定を確認してください`));
  try {
    await addCloudScene(episodeId, parsed.data.title, parsed.data.summary);
  } catch (error) {
    redirect(`/creator/${projectId}?error=${encodeURIComponent(domainMessage(error, "シーンを追加できませんでした。"))}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(encodeURI(`/creator/${projectId}?message=シーンを追加しました`));
}

export async function addCloudPageToSceneAction(projectId: string, sceneId: string) {
  let pageId: string;
  try {
    pageId = await addCloudPageToScene(sceneId);
  } catch (error) {
    redirect(`/creator/${projectId}?error=${encodeURIComponent(domainMessage(error, "ページを追加できませんでした。"))}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(`/creator/${projectId}/pages/${pageId}`);
}

export async function moveCloudPageBeforeAction(
  projectId: string,
  pageId: string,
  targetPageId: string,
) {
  const parsed = z.object({ projectId: z.string().uuid(), pageId: z.string().uuid(), targetPageId: z.string().uuid() }).safeParse({ projectId, pageId, targetPageId });
  if (!parsed.success) throw new Error("invalid_page_move");
  try {
    await moveCloudPageBefore(parsed.data.pageId, parsed.data.targetPageId);
  } catch (error) {
    throw new Error(domainMessage(error, "ページを並べ替えできませんでした。"));
  }
  revalidatePath(`/creator/${parsed.data.projectId}`);
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
      title: formString(formData, "title"),
      description: formString(formData, "description"),
    });
  if (!parsed.success)
    redirect(encodeURI(`/creator/${projectId}?error=作品情報を確認してください`));
  try {
    await renameCloudProject(
      projectId,
      parsed.data.title,
      parsed.data.description,
    );
  } catch (error) {
    const message = domainMessage(error, "作品を更新できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(encodeURI(`/creator/${projectId}?message=作品情報を更新しました`));
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
    .safeParse(formString(formData, "title"));
  if (!parsed.success)
    redirect(encodeURI(`/creator/${projectId}?error=話の名前を確認してください`));
  try {
    await renameCloudEpisode(episodeId, parsed.data);
  } catch (error) {
    const message = domainMessage(error, "話の名前を更新できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  redirect(encodeURI(`/creator/${projectId}?message=話の名前を更新しました`));
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
    `/creator/${projectId}?message=${kind === "episode" ? "話" : "ページ"}をゴミ箱へ移動しました`,
  );
}

export async function deleteCloudProjectAction(projectId: string) {
  try {
    await setCloudProjectDeleted(projectId, true);
  } catch (error) {
    const message = domainMessage(error, "作品を削除できませんでした。");
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/creator");
  revalidatePath("/creator/trash");
  redirect(encodeURI("/creator?message=作品をゴミ箱へ移動しました"));
}

export async function restoreCloudProjectAction(projectId: string) {
  try {
    await setCloudProjectDeleted(projectId, false);
  } catch (error) {
    const message = domainMessage(error, "作品を復元できませんでした。");
    redirect(`/creator/trash?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/creator");
  revalidatePath("/creator/trash");
  redirect(encodeURI(`/creator/${projectId}?message=作品を復元しました`));
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
  redirect(encodeURI(`/creator/${projectId}?message=表紙ページを設定しました`));
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
    .safeParse(formString(formData, "price"));
  if (!parsed.success)
    redirect(encodeURI(`/creator/${projectId}?error=販売価格を確認してください`));
  let result: Awaited<ReturnType<typeof syncCloudMarketplaceDraft>>;
  try {
    result = await syncCloudMarketplaceDraft({
      projectId,
      price: parsed.data,
    });
  } catch (error) {
    const message = domainMessage(
      error,
      "販売用の下書きを作成できませんでした。",
    );
    redirect(`/creator/${projectId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/creator/${projectId}`);
  revalidatePath("/dashboard/works");
  revalidatePath("/dashboard/products");
  redirect(
    `/creator/${projectId}?message=${encodeURIComponent("販売用の下書きを更新しました")}&productId=${result.productId}`,
  );
}

export async function startCloudPageGenerationBatchAction(projectId: string, formData: FormData) {
  const parsedProjectId = z.string().uuid().safeParse(projectId);
  if (!parsedProjectId.success) redirect(encodeURI("/creator?error=作品IDを確認してください"));
  const parsed = z.array(z.string().uuid()).min(4).max(8).safeParse(formData.getAll("pageId"));
  if (!parsed.success) redirect(`/creator/${parsedProjectId.data}?error=${encodeURIComponent("一括生成するページを4〜8ページ選んでください。")}`);
  let result: Awaited<ReturnType<typeof startCloudPageGenerationBatch>>;
  try {
    result = await startCloudPageGenerationBatch(parsedProjectId.data, parsed.data);
    revalidatePath(`/creator/${parsedProjectId.data}`);
  } catch (error) {
    redirect(`/creator/${parsedProjectId.data}?error=${encodeURIComponent(domainMessage(error, "一括生成を開始できませんでした。"))}`);
  }
  const unqueued = result.requested - result.queued;
  const parameter = result.partial ? "error" : "message";
  const message = result.partial
    ? `${result.requested}コマ中${result.queued}コマだけ登録され、${unqueued}コマは未登録です。一括生成履歴を確認し、追加実行しないでください。`
    : `${result.requested}コマすべての一括生成を開始しました`;
  redirect(`/creator/${parsedProjectId.data}?${parameter}=${encodeURIComponent(message)}`);
}

export async function setCloudGenerationBatchStateAction(projectId: string, batchId: string, status: "active" | "paused" | "canceled") {
  const ids = z.object({ projectId: z.string().uuid(), batchId: z.string().uuid() }).safeParse({ projectId, batchId });
  if (!ids.success) redirect(encodeURI("/creator?error=一括生成のIDを確認してください"));
  try { await setCloudGenerationBatchState(ids.data.batchId, status); }
  catch (error) { redirect(`/creator/${ids.data.projectId}?error=${encodeURIComponent(domainMessage(error, "一括生成の状態を変更できませんでした。"))}`); }
  revalidatePath(`/creator/${ids.data.projectId}`);
  redirect(`/creator/${ids.data.projectId}?message=${encodeURIComponent(status === "paused" ? "一括生成を一時停止しました" : status === "active" ? "一括生成を再開しました" : "一括生成を中止しました")}`);
}

export async function retryFailedCloudGenerationJobAction(projectId: string, jobId: string) {
  const ids = z.object({ projectId: z.string().uuid(), jobId: z.string().uuid() }).safeParse({ projectId, jobId });
  if (!ids.success) redirect(encodeURI("/creator?error=再実行対象のIDを確認してください"));
  try { await retryFailedCloudGenerationJob(ids.data.jobId); }
  catch (error) { redirect(`/creator/${ids.data.projectId}?error=${encodeURIComponent(domainMessage(error, "失敗Jobを再実行できませんでした。"))}`); }
  revalidatePath(`/creator/${ids.data.projectId}`);
  redirect(`/creator/${ids.data.projectId}?message=${encodeURIComponent("失敗Jobを再実行しました")}`);
}

export async function setCloudPageProductionStatusAction(
  projectId: string,
  pageId: string,
  status: "not_started" | "review_required" | "revision_required" | "finalized",
) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    pageId: z.string().uuid(),
    status: z.enum(["not_started", "review_required", "revision_required", "finalized"]),
  }).safeParse({ projectId, pageId, status });
  if (!parsed.success) redirect(encodeURI("/creator?error=制作状態を確認してください"));
  try { await setCloudPageProductionStatus(parsed.data.pageId, parsed.data.status); }
  catch (error) { redirect(`/creator/${parsed.data.projectId}?error=${encodeURIComponent(domainMessage(error, "制作状態を更新できませんでした。"))}`); }
  revalidatePath(`/creator/${parsed.data.projectId}`);
  redirect(`/creator/${parsed.data.projectId}?message=${encodeURIComponent(status === "finalized" ? "ページを確定しました" : "ページの制作状態を更新しました")}`);
}

export async function startCloudExportAction(projectId: string) {
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) redirect(encodeURI("/creator?error=作品IDを確認してください"));
  try {
    await createCloudExportJob(parsed.data);
  } catch (error) {
    redirect(`/creator/${parsed.data}?error=${encodeURIComponent(domainMessage(error, "書き出しを開始できませんでした。"))}`);
  }
  revalidatePath(`/creator/${parsed.data}`);
  redirect(`/creator/${parsed.data}?message=${encodeURIComponent("PDF書き出しを受け付けました")}`);
}

export async function createCloudProjectCheckpointAction(projectId: string, kind: "checkpoint" | "release", formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    kind: z.enum(["checkpoint", "release"]),
    label: z.string().trim().min(1).max(100),
  }).safeParse({ projectId, kind, label: formString(formData, "label") });
  if (!parsed.success) redirect(`/creator?error=${encodeURIComponent("固定版の入力内容を確認してください。")}`);
  try { await createCloudProjectCheckpoint(parsed.data); }
  catch (error) { redirect(`/creator/${parsed.data.projectId}?error=${encodeURIComponent(domainMessage(error, "作品の固定版を作成できませんでした。"))}`); }
  revalidatePath(`/creator/${parsed.data.projectId}`);
  redirect(`/creator/${parsed.data.projectId}?message=${encodeURIComponent(parsed.data.kind === "release" ? "完成版を固定しました" : "バックアップを作成しました")}`);
}

export async function restoreCloudProjectCheckpointAction(projectId: string, checkpointId: string, formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    checkpointId: z.string().uuid(),
    confirm: z.literal("restore"),
  }).safeParse({ projectId, checkpointId, confirm: formString(formData, "confirm") });
  if (!parsed.success) redirect(`/creator?error=${encodeURIComponent("復元確認にチェックを入れてください。")}`);
  try { await restoreCloudProjectCheckpoint(parsed.data); }
  catch (error) { redirect(`/creator/${parsed.data.projectId}?error=${encodeURIComponent(domainMessage(error, "固定版を復元できませんでした。"))}`); }
  revalidatePath(`/creator/${parsed.data.projectId}`);
  revalidatePath(`/creator/${parsed.data.projectId}/cockpit`);
  redirect(`/creator/${parsed.data.projectId}?message=${encodeURIComponent("固定版を復元しました。現在の内容は復元前バックアップとして保存されています。")}`);
}

export async function setCloudExportStateAction(
  projectId: string,
  jobId: string,
  status: "queued" | "paused" | "canceled",
) {
  const parsed = z.object({ projectId: z.string().uuid(), jobId: z.string().uuid(), status: z.enum(["queued", "paused", "canceled"]) }).safeParse({ projectId, jobId, status });
  if (!parsed.success) redirect(encodeURI("/creator?error=書き出しIDを確認してください"));
  try {
    await setCloudExportJobState(parsed.data.jobId, parsed.data.status);
  } catch (error) {
    redirect(`/creator/${parsed.data.projectId}?error=${encodeURIComponent(domainMessage(error, "書き出し状態を変更できませんでした。"))}`);
  }
  revalidatePath(`/creator/${parsed.data.projectId}`);
  redirect(`/creator/${parsed.data.projectId}?message=${encodeURIComponent(status === "paused" ? "書き出しを一時停止しました" : status === "queued" ? "書き出しを再開しました" : "書き出しを中止しました")}`);
}
