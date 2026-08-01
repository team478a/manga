"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cloudContinuityFactInputSchema, cloudPlotThreadInputSchema } from "@/lib/cloud-narrative-continuity";
import { deleteCloudContinuityFact, deleteCloudPlotThread, saveCloudContinuityFact, saveCloudPlotThread } from "@/lib/cloud-creator-server";

const ids = z.object({ projectId: z.string().uuid(), itemId: z.string().uuid() });
const text = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)) : "";
const integer = (form: FormData, key: string) => { const value=text(form,key);return value ? Number(value) : null; };
const target = (projectId:string, kind:"message"|"error", message:string) => `/creator/${projectId}/continuity?${kind}=${encodeURIComponent(message)}`;

export async function saveContinuityFactAction(projectId:string, form:FormData) {
  const factId=text(form,"factId");
  const parsed=cloudContinuityFactInputSchema.safeParse({projectId,factId:factId||null,factKind:text(form,"factKind"),subject:text(form,"subject"),attribute:text(form,"attribute"),factValue:text(form,"factValue"),startPage:integer(form,"startPage"),endPage:integer(form,"endPage"),sourcePage:integer(form,"sourcePage"),notes:text(form,"notes")});
  if(!parsed.success) redirect(target(projectId,"error","事実の入力内容とページ範囲を確認してください。"));
  await saveCloudContinuityFact(parsed.data).catch(()=>redirect(target(projectId,"error","事実を保存できませんでした。")));
  revalidatePath(`/creator/${projectId}/continuity`);redirect(target(projectId,"message","連続性の事実を保存しました。"));
}

export async function deleteContinuityFactAction(projectId:string,factId:string) {
  if(!ids.safeParse({projectId,itemId:factId}).success) redirect(target(projectId,"error","対象を確認できませんでした。"));
  await deleteCloudContinuityFact(projectId,factId).catch(()=>redirect(target(projectId,"error","事実を削除できませんでした。")));
  revalidatePath(`/creator/${projectId}/continuity`);redirect(target(projectId,"message","連続性の事実を削除しました。"));
}

export async function savePlotThreadAction(projectId:string,form:FormData) {
  const threadId=text(form,"threadId");
  const parsed=cloudPlotThreadInputSchema.safeParse({projectId,threadId:threadId||null,title:text(form,"title"),setupPage:integer(form,"setupPage"),targetPayoffPage:integer(form,"targetPayoffPage"),payoffPage:integer(form,"payoffPage"),status:text(form,"status"),notes:text(form,"notes")});
  if(!parsed.success) redirect(target(projectId,"error","伏線の入力内容とページ番号を確認してください。"));
  await saveCloudPlotThread(parsed.data).catch(()=>redirect(target(projectId,"error","伏線を保存できませんでした。")));
  revalidatePath(`/creator/${projectId}/continuity`);redirect(target(projectId,"message","伏線を保存しました。"));
}

export async function deletePlotThreadAction(projectId:string,threadId:string) {
  if(!ids.safeParse({projectId,itemId:threadId}).success) redirect(target(projectId,"error","対象を確認できませんでした。"));
  await deleteCloudPlotThread(projectId,threadId).catch(()=>redirect(target(projectId,"error","伏線を削除できませんでした。")));
  revalidatePath(`/creator/${projectId}/continuity`);redirect(target(projectId,"message","伏線を削除しました。"));
}
