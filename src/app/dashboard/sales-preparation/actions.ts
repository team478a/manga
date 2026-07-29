"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import { syncCloudMarketplaceDraft } from "@/lib/cloud-marketplace";
import {
  cloudSalesPreparationFeatureEnabled,
  cloudSalesPreparationInputSchema,
} from "@/lib/cloud-sales-preparation";
import { getCloudSalesPreparationDetail } from "@/lib/cloud-sales-preparation-server";
import { ValidationError } from "@/lib/domain-errors";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

export async function syncCloudSalesPreparationAction(formData: FormData) {
  const parsed = cloudSalesPreparationInputSchema.safeParse({
    projectId: value(formData, "projectId"),
    expectedRevision: value(formData, "expectedRevision"),
    price: value(formData, "price"),
  });
  const fallbackProjectId = value(formData, "projectId");
  if (!cloudSalesPreparationFeatureEnabled())
    redirect("/dashboard/sales-preparation?error=販売準備は現在停止中です");
  if (!parsed.success)
    redirect(
      `/dashboard/sales-preparation/${fallbackProjectId}?error=販売価格とProject revisionを確認してください`,
    );
  const { profile } = await requireProfile();
  let result: Awaited<ReturnType<typeof syncCloudMarketplaceDraft>>;
  try {
    const detail = await getCloudSalesPreparationDetail(
      profile.id,
      parsed.data.projectId,
    );
    if (
      !detail.eligible ||
      detail.project.revision !== parsed.data.expectedRevision
    )
      throw new ValidationError(
        "作品管理で現行revisionを承認してください。",
      );
    result = await syncCloudMarketplaceDraft({
      projectId: parsed.data.projectId,
      price: parsed.data.price,
    });
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "販売下書きを同期できませんでした。",
    );
    redirect(
      `/dashboard/sales-preparation/${parsed.data.projectId}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidatePath("/dashboard/sales-preparation");
  revalidatePath(`/dashboard/sales-preparation/${parsed.data.projectId}`);
  revalidatePath("/dashboard/works");
  revalidatePath("/dashboard/products");
  redirect(
    `/dashboard/sales-preparation/${parsed.data.projectId}?message=${encodeURIComponent("販売下書きを同期しました")}&productId=${result.productId}`,
  );
}
