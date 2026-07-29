"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import {
  cloudWorkManagementFeatureEnabled,
  cloudWorkStatusSchema,
} from "@/lib/cloud-work-management";
import {
  setCloudWorkManagementStatus,
  setCloudWorkPageReview,
} from "@/lib/cloud-work-management-server";
import { PermissionDeniedError } from "@/lib/domain-errors";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function assertEnabled() {
  if (!cloudWorkManagementFeatureEnabled())
    throw new PermissionDeniedError("作品管理機能は現在停止中です。");
}

export async function setCloudWorkPageReviewAction(formData: FormData) {
  const projectId = text(formData, "projectId");
  try {
    assertEnabled();
    await requireProfile();
    await setCloudWorkPageReview({
      projectId,
      pageId: text(formData, "pageId"),
      reviewed: text(formData, "reviewed") === "true",
      note: text(formData, "note"),
    });
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "Page確認状態を更新できませんでした。",
    );
    redirect(
      `/dashboard/projects/${projectId}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(
    `/dashboard/projects/${projectId}?message=${encodeURIComponent("Page確認状態を更新しました")}`,
  );
}

export async function setCloudWorkManagementStatusAction(
  formData: FormData,
) {
  const projectId = text(formData, "projectId");
  try {
    assertEnabled();
    await requireProfile();
    await setCloudWorkManagementStatus({
      projectId,
      status: cloudWorkStatusSchema.parse(text(formData, "status")),
      releaseNotes: text(formData, "releaseNotes"),
      expectedRevision: Number(text(formData, "expectedRevision")),
    });
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "作品管理状態を更新できませんでした。",
    );
    redirect(
      `/dashboard/projects/${projectId}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(
    `/dashboard/projects/${projectId}?message=${encodeURIComponent("作品管理状態を更新しました")}`,
  );
}
