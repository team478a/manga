"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  cloudPanelSubjectAssignmentInputSchema,
  cloudVisualReferenceInputSchema,
  cloudVisualSubjectKindSchema,
} from "@/lib/cloud-visual-references";
import {
  deleteCloudPanelSubjectAssignment,
  deleteCloudVisualReference,
  saveCloudPanelSubjectAssignment,
  saveCloudVisualReference,
  uploadCloudAsset,
} from "@/lib/cloud-creator-server";

const uuid = z.string().uuid();
const value = (form: FormData, key: string) =>
  typeof form.get(key) === "string" ? String(form.get(key)) : "";
const back = (
  projectId: string,
  key: "message" | "error",
  message: string,
): never => {
  redirect(`/creator/${projectId}/references?${key}=${encodeURIComponent(message)}`);
};

function subject(value: string) {
  const [kind, id] = value.split(":");
  const parsed = z.tuple([cloudVisualSubjectKindSchema, uuid]).safeParse([kind, id]);
  return parsed.success ? { kind: parsed.data[0], id: parsed.data[1] } : null;
}

export async function uploadVisualReferenceAction(projectId: string, form: FormData) {
  if (!uuid.safeParse(projectId).success) back(projectId, "error", "作品を確認できませんでした。");
  const target = subject(value(form, "subject"));
  const file = form.get("file");
  if (!target) return back(projectId, "error", "設定対象を選択してください。");
  if (!(file instanceof File) || !file.size)
    return back(projectId, "error", "画像を選択してください。");
  try {
    const asset = await uploadCloudAsset({
      projectId,
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
    });
    const parsed = cloudVisualReferenceInputSchema.parse({
      projectId,
      subjectKind: target.kind,
      subjectId: target.id,
      assetId: asset.id,
      label: value(form, "label"),
    });
    await saveCloudVisualReference(parsed);
  } catch {
    back(projectId, "error", "参照画像を保存できませんでした。画像形式と容量を確認してください。");
  }
  revalidatePath(`/creator/${projectId}`);
  revalidatePath(`/creator/${projectId}/references`);
  back(projectId, "message", "参照画像を保存しました。");
}

export async function assignPanelSubjectAction(projectId: string, form: FormData) {
  const target = subject(value(form, "subject"));
  const [pageId, panelId] = value(form, "panel").split(":");
  if (!target || target.kind === "style")
    return back(projectId, "error", "割り当てる設定を確認してください。");
  const parsed = cloudPanelSubjectAssignmentInputSchema.safeParse({
    projectId,
    pageId,
    panelId,
    subjectKind: target.kind,
    subjectId: target.id,
  });
  if (!parsed.success) return back(projectId, "error", "割当先のコマを確認してください。");
  await saveCloudPanelSubjectAssignment(parsed.data).catch(() =>
    back(projectId, "error", "コマへの割当を保存できませんでした。"),
  );
  revalidatePath(`/creator/${projectId}/references`);
  back(projectId, "message", "設定をコマへ割り当てました。");
}

export async function deleteVisualReferenceAction(projectId: string, referenceId: string) {
  if (!uuid.safeParse(projectId).success || !uuid.safeParse(referenceId).success)
    back(projectId, "error", "参照画像を確認できませんでした。");
  await deleteCloudVisualReference(projectId, referenceId).catch(() =>
    back(projectId, "error", "参照画像を解除できませんでした。"),
  );
  revalidatePath(`/creator/${projectId}/references`);
  back(projectId, "message", "参照画像の関連付けを解除しました。");
}

export async function deletePanelAssignmentAction(projectId: string, assignmentId: string) {
  if (!uuid.safeParse(projectId).success || !uuid.safeParse(assignmentId).success)
    back(projectId, "error", "割当を確認できませんでした。");
  await deleteCloudPanelSubjectAssignment(projectId, assignmentId).catch(() =>
    back(projectId, "error", "コマへの割当を解除できませんでした。"),
  );
  revalidatePath(`/creator/${projectId}/references`);
  back(projectId, "message", "コマへの割当を解除しました。");
}
