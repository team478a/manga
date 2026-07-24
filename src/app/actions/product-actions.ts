"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validateDigitalProductFile } from "./shared/file-validation";
import { formText } from "./shared/form-data";
import {
  persistWithStorageRollback,
  uploadMarketplaceFile,
} from "./shared/storage-transaction";

const DIGITAL_PRODUCTS_BUCKET = "digital-products";

export async function createDigitalProduct(formData: FormData) {
  const { user, profile } = await requireProfile();
  const title = formText(formData, "title");
  const workId = formText(formData, "workId");
  const price = Number(formText(formData, "price"));
  const status =
    formText(formData, "status") === "paused" ? "paused" : "active";
  if (!title || !workId || Number.isNaN(price) || price < 0) {
    redirect(
      "/dashboard/products/new?error=商品名、作品、価格を確認してください",
    );
  }

  const supabase = await createClient();
  const { data: work } = await supabase
    .from("works")
    .select("id")
    .eq("id", workId)
    .eq("creator_id", profile.id)
    .eq("content_class", "general")
    .maybeSingle();
  if (!work) {
    redirect(
      "/dashboard/products/new?error=自分の作品だけを商品に紐づけできます",
    );
  }

  const productId = crypto.randomUUID();
  let result: { error: { message: string } | null };
  try {
    const productFile = validateDigitalProductFile(formData.get("file"), true);
    const upload = await uploadMarketplaceFile({
      supabase,
      bucket: DIGITAL_PRODUCTS_BUCKET,
      file: productFile,
      authUserId: user.id,
      resourceId: productId,
    });
    result = await persistWithStorageRollback({
      supabase,
      upload,
      persist: () =>
        supabase.from("digital_products").insert({
          id: productId,
          work_id: workId,
          creator_id: profile.id,
          title,
          description: formText(formData, "description"),
          file_url: upload?.value ?? null,
          price,
          status,
        }),
    });
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "販売ファイルのアップロードに失敗しました",
    );
    redirect(`/dashboard/products/new?error=${encodeURIComponent(message)}`);
  }
  if (result.error) {
    redirect(
      `/dashboard/products/new?error=${encodeURIComponent("販売商品を登録できませんでした")}`,
    );
  }
  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?message=販売商品を登録しました");
}

export async function updateDigitalProduct(formData: FormData) {
  const { user, profile } = await requireProfile();
  const id = formText(formData, "id");
  const title = formText(formData, "title");
  const workId = formText(formData, "workId");
  const price = Number(formText(formData, "price"));
  const status =
    formText(formData, "status") === "paused" ? "paused" : "active";
  if (!id || !title || !workId || Number.isNaN(price) || price < 0) {
    redirect("/dashboard/products?error=商品情報を確認してください");
  }

  const supabase = await createClient();
  const [{ data: product }, { data: work }] = await Promise.all([
    supabase
      .from("digital_products")
      .select("id")
      .eq("id", id)
      .eq("creator_id", profile.id)
      .maybeSingle(),
    supabase
      .from("works")
      .select("id")
      .eq("id", workId)
      .eq("creator_id", profile.id)
      .eq("content_class", "general")
      .maybeSingle(),
  ]);
  if (!product) {
    redirect(
      "/dashboard/products?error=商品が見つからないか、編集権限がありません",
    );
  }
  if (!work) {
    redirect(
      `/dashboard/products/${id}/edit?error=自分の作品だけを商品に紐づけできます`,
    );
  }

  const update: Record<string, unknown> = {
    work_id: workId,
    title,
    description: formText(formData, "description"),
    price,
    status,
  };
  let result: { error: { message: string } | null };
  try {
    const productFile = validateDigitalProductFile(
      formData.get("file"),
      false,
    );
    const upload = await uploadMarketplaceFile({
      supabase,
      bucket: DIGITAL_PRODUCTS_BUCKET,
      file: productFile,
      authUserId: user.id,
      resourceId: id,
    });
    if (upload) update.file_url = upload.value;
    result = await persistWithStorageRollback({
      supabase,
      upload,
      persist: () =>
        supabase
          .from("digital_products")
          .update(update)
          .eq("id", id)
          .eq("creator_id", profile.id),
    });
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "販売ファイルのアップロードに失敗しました",
    );
    redirect(
      `/dashboard/products/${id}/edit?error=${encodeURIComponent(message)}`,
    );
  }
  if (result.error) {
    redirect(
      `/dashboard/products/${id}/edit?error=${encodeURIComponent("販売商品を更新できませんでした")}`,
    );
  }
  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?message=販売商品を更新しました");
}
