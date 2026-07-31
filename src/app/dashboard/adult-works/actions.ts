"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  cloudAdultWorkUpdateSchema,
} from "@/lib/cloud-adult-work-management";
import { updateCloudAdultWork } from "@/lib/cloud-adult-work-management-server";

function value(formData: FormData, name: string) {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
}

export async function updateCloudAdultWorkAction(
  projectId: string,
  formData: FormData,
) {
  const target = `/dashboard/adult-works/${encodeURIComponent(projectId)}`;
  const parsed = cloudAdultWorkUpdateSchema.safeParse({
    projectId,
    title: value(formData, "title"),
    description: value(formData, "description"),
    status: value(formData, "status"),
    notes: value(formData, "notes"),
  });
  if (!parsed.success)
    redirect(`${target}?error=${encodeURIComponent("入力内容を確認してください。")}`);
  try {
    await updateCloudAdultWork(parsed.data);
  } catch {
    redirect(
      `${target}?error=${encodeURIComponent(
        "作品を更新できませんでした。時間を置いて再度お試しください。",
      )}`,
    );
  }
  revalidatePath("/dashboard/adult-works");
  revalidatePath(target);
  revalidatePath(`/creator/${projectId}`);
  redirect(`${target}?message=${encodeURIComponent("作品情報を更新しました。")}`);
}
