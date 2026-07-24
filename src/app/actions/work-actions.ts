"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { splitTags } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { validateWorkImage } from "./shared/file-validation";
import { formText } from "./shared/form-data";
import {
  persistWithStorageRollback,
  uploadMarketplaceFile,
} from "./shared/storage-transaction";

const WORKS_BUCKET = "works";

export async function createWork(formData: FormData) {
  const { user, profile } = await requireProfile();
  const title = formText(formData, "title");
  if (!title) redirect("/dashboard/works/new?error=作品名を入力してください");

  const workId = crypto.randomUUID();
  const supabase = await createClient();
  let result: { error: { message: string } | null };
  try {
    const imageFile = validateWorkImage(formData.get("image"), true);
    const upload = await uploadMarketplaceFile({
      supabase,
      bucket: WORKS_BUCKET,
      file: imageFile,
      authUserId: user.id,
      resourceId: workId,
      publicUrl: true,
    });
    result = await persistWithStorageRollback({
      supabase,
      upload,
      persist: () =>
        supabase.from("works").insert({
          id: workId,
          creator_id: profile.id,
          title,
          description: formText(formData, "description"),
          image_url: upload?.value ?? null,
          tags: splitTags(formData.get("tags")),
          content_class: "general",
          status:
            formText(formData, "visibility") === "public" ||
            formText(formData, "isPublic") === "on"
              ? "published"
              : "draft",
          is_public:
            formText(formData, "visibility") === "public" ||
            formText(formData, "isPublic") === "on",
        }),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "画像のアップロードに失敗しました。";
    redirect(`/dashboard/works/new?error=${encodeURIComponent(message)}`);
  }
  if (result.error) {
    redirect(
      `/dashboard/works/new?error=${encodeURIComponent(result.error.message)}`,
    );
  }
  revalidatePath("/dashboard/works");
  revalidatePath("/works");
  redirect("/dashboard/works?message=作品を保存しました");
}

export async function updateWork(formData: FormData) {
  const { user, profile } = await requireProfile();
  const id = formText(formData, "id");
  const title = formText(formData, "title");
  if (!id || !title)
    redirect("/dashboard/works?error=作品を保存できませんでした");

  const supabase = await createClient();
  const { data: ownedWork } = await supabase
    .from("works")
    .select("id")
    .eq("id", id)
    .eq("creator_id", profile.id)
    .eq("content_class", "general")
    .maybeSingle();
  if (!ownedWork) {
    redirect(
      "/dashboard/works?error=作品が見つからないか、編集権限がありません",
    );
  }

  const isPublic =
    formText(formData, "visibility") === "public" ||
    formText(formData, "isPublic") === "on";
  const update: Record<string, unknown> = {
    title,
    description: formText(formData, "description"),
    tags: splitTags(formData.get("tags")),
    is_public: isPublic,
    status: isPublic ? "published" : "draft",
  };

  let result: { error: { message: string } | null };
  try {
    const imageFile = validateWorkImage(formData.get("image"), false);
    const upload = await uploadMarketplaceFile({
      supabase,
      bucket: WORKS_BUCKET,
      file: imageFile,
      authUserId: user.id,
      resourceId: id,
      publicUrl: true,
    });
    if (upload) update.image_url = upload.value;
    result = await persistWithStorageRollback({
      supabase,
      upload,
      persist: () =>
        supabase
          .from("works")
          .update(update)
          .eq("id", id)
          .eq("creator_id", profile.id),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "画像のアップロードに失敗しました。";
    redirect(
      `/dashboard/works/${id}/edit?error=${encodeURIComponent(message)}`,
    );
  }
  if (result.error) {
    redirect(
      `/dashboard/works/${id}/edit?error=${encodeURIComponent(result.error.message)}`,
    );
  }
  revalidatePath("/dashboard/works");
  revalidatePath(`/works/${id}`);
  redirect("/dashboard/works?message=作品を更新しました");
}
