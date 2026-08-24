"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  characterReferenceBindingInputSchema,characterStateAssignmentInputSchema,
} from "@/lib/cloud-character-reference-settings";
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
  deleteCloudCharacterReferenceBinding,deleteCloudCharacterStateAssignment,
  saveCloudCharacterReferenceBinding,saveCloudCharacterStateAssignment,saveCloudGenerationReadinessPolicy,
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

export async function linkExistingVisualReferenceAction(projectId: string, form: FormData) {
  if (!uuid.safeParse(projectId).success)
    back(projectId, "error", "作品を確認できませんでした。");
  const target = subject(value(form, "subject"));
  const assetId = uuid.safeParse(value(form, "asset"));
  if (!target) return back(projectId, "error", "設定対象を選択してください。");
  if (!assetId.success)
    return back(projectId, "error", "参照に使う画像素材を選択してください。");
  const parsed = cloudVisualReferenceInputSchema.safeParse({
    projectId,
    subjectKind: target.kind,
    subjectId: target.id,
    assetId: assetId.data,
    label: value(form, "label"),
  });
  if (!parsed.success)
    return back(projectId, "error", "参照画像の設定を確認してください。");
  await saveCloudVisualReference(parsed.data).catch(() =>
    back(projectId, "error", "既存の画像素材を参照画像に設定できませんでした。"),
  );
  revalidatePath(`/creator/${projectId}`);
  revalidatePath(`/creator/${projectId}/references`);
  back(projectId, "message", "既存の画像素材を参照画像に設定しました。");
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

export async function saveCharacterReferenceBindingAction(projectId:string,form:FormData){
 const [characterProfileId,characterVersionId]=value(form,"characterVersion").split(":");
 const parsed=characterReferenceBindingInputSchema.safeParse({projectId,characterProfileId,characterVersionId,assetId:value(form,"assetId"),role:value(form,"role"),expressionKey:value(form,"expressionKey"),priority:Number(value(form,"priority")),reviewStatus:value(form,"reviewStatus")});
 if(!parsed.success)return back(projectId,"error","人物version・参照roleの設定を確認してください。");
 await saveCloudCharacterReferenceBinding(parsed.data).catch(()=>back(projectId,"error","人物versionへの参照画像設定を保存できませんでした。"));revalidatePath(`/creator/${projectId}/references`);back(projectId,"message","人物versionへ参照画像を設定しました。");
}
export async function deleteCharacterReferenceBindingAction(projectId:string,bindingId:string){if(!uuid.safeParse(bindingId).success)return back(projectId,"error","人物参照設定を確認できませんでした。");await deleteCloudCharacterReferenceBinding(projectId,bindingId).catch(()=>back(projectId,"error","人物参照設定を解除できませんでした。"));revalidatePath(`/creator/${projectId}/references`);back(projectId,"message","人物参照設定を解除しました。");}
export async function saveCharacterStateAssignmentAction(projectId:string,form:FormData){const[characterProfileId,characterVersionId]=value(form,"characterVersion").split(":");const parsed=characterStateAssignmentInputSchema.safeParse({projectId,characterProfileId,characterVersionId,startPage:Number(value(form,"startPage")),endPage:Number(value(form,"endPage")),sceneKey:value(form,"sceneKey"),label:value(form,"assignmentLabel"),costumeOverride:value(form,"costumeOverride"),stateNote:value(form,"stateNote"),priority:Number(value(form,"priority"))});if(!parsed.success)return back(projectId,"error","衣装・状態のページ範囲を確認してください。");await saveCloudCharacterStateAssignment(parsed.data).catch(()=>back(projectId,"error","範囲が重複しているか、衣装・状態を保存できませんでした。"));revalidatePath(`/creator/${projectId}/references`);back(projectId,"message","衣装・状態の適用範囲を保存しました。");}
export async function deleteCharacterStateAssignmentAction(projectId:string,assignmentId:string){if(!uuid.safeParse(assignmentId).success)return back(projectId,"error","適用範囲を確認できませんでした。");await deleteCloudCharacterStateAssignment(projectId,assignmentId).catch(()=>back(projectId,"error","適用範囲を解除できませんでした。"));revalidatePath(`/creator/${projectId}/references`);back(projectId,"message","衣装・状態の適用範囲を解除しました。");}
export async function saveGenerationReadinessPolicyAction(projectId:string,form:FormData){const policy=z.enum(["warn","block"]).safeParse(value(form,"policy"));if(!policy.success)return back(projectId,"error","参照画像不足時の方針を確認してください。");await saveCloudGenerationReadinessPolicy(projectId,policy.data).catch(()=>back(projectId,"error","参照画像不足時の方針を保存できませんでした。"));revalidatePath(`/creator/${projectId}/references`);back(projectId,"message","生成準備方針を保存しました。");}
