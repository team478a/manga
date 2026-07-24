"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  firstValidationMessage,
  normalizeCreatorTags,
  workInputSchema,
} from "@/lib/creator-input";
import { createClient } from "@/lib/supabase/server";
import { validateWorkImage } from "./shared/file-validation";
import { formText } from "./shared/form-data";
import {
  ownedStoragePathFromPublicUrl,
  persistWithStorageRollback,
  removeStorageObject,
  uploadMarketplaceFile,
} from "./shared/storage-transaction";

const WORKS_BUCKET = "works";

export async function createWork(formData: FormData) {
  const { user, profile } = await requireProfile();
  const input = workInputSchema.safeParse({
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    tags: normalizeCreatorTags(formData.get("tags")),
    visibility:
      formText(formData, "visibility") === "public" ? "public" : "private",
  });
  if (!input.success) {
    redirect(
      `/dashboard/works/new?error=${encodeURIComponent(firstValidationMessage(input.error))}`,
    );
  }

  const workId = crypto.randomUUID();
  const supabase = await createClient();
  let result: { error: { message: string } | null };
  try {
    const imageFile = await validateWorkImage(formData.get("image"), true);
    const upload = await uploadMarketplaceFile({
      supabase,
      bucket: WORKS_BUCKET,
      file: imageFile,
      authUserId: user.id,
      resourceId: workId,
      publicUrl: true,
    });
    const isPublic = input.data.visibility === "public";
    result = await persistWithStorageRollback({
      supabase,
      upload,
      persist: () =>
        supabase.from("works").insert({
          id: workId,
          creator_id: profile.id,
          title: input.data.title,
          description: input.data.description,
          image_url: upload?.value ?? null,
          tags: input.data.tags,
          content_class: "general",
          status: isPublic ? "published" : "draft",
          is_public: isPublic,
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
    redirect("/dashboard/works/new?error=作品を保存できませんでした");
  }
  revalidatePath("/dashboard/works");
  revalidatePath("/works");
  redirect("/dashboard/works?message=作品を保存しました");
}

export async function updateWork(formData: FormData) {
  const { user, profile } = await requireProfile();
  const id = formText(formData, "id");
  if (!id) redirect("/dashboard/works?error=作品を保存できませんでした");

  const input = workInputSchema.safeParse({
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    tags: normalizeCreatorTags(formData.get("tags")),
    visibility:
      formText(formData, "visibility") === "public" ? "public" : "private",
  });
  if (!input.success) {
    redirect(
      `/dashboard/works/${id}/edit?error=${encodeURIComponent(firstValidationMessage(input.error))}`,
    );
  }

  const supabase = await createClient();
  const { data: ownedWork } = await supabase
    .from("works")
    .select("id,image_url")
    .eq("id", id)
    .eq("creator_id", profile.id)
    .eq("content_class", "general")
    .maybeSingle();
  if (!ownedWork) {
    redirect(
      "/dashboard/works?error=作品が見つからないか、編集権限がありません",
    );
  }

  const isPublic = input.data.visibility === "public";
  const update: Record<string, unknown> = {
    title: input.data.title,
    description: input.data.description,
    tags: input.data.tags,
    is_public: isPublic,
    status: isPublic ? "published" : "draft",
  };

  let result: { error: { message: string } | null };
  let upload: Awaited<ReturnType<typeof uploadMarketplaceFile>> = null;
  try {
    const imageFile = await validateWorkImage(formData.get("image"), false);
    upload = await uploadMarketplaceFile({
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
    redirect(`/dashboard/works/${id}/edit?error=作品を保存できませんでした`);
  }
  if (upload) {
    const previousPath = ownedStoragePathFromPublicUrl(
      ownedWork.image_url,
      WORKS_BUCKET,
      user.id,
      id,
    );
    if (previousPath) {
      await removeStorageObject(supabase, WORKS_BUCKET, previousPath);
    }
  }
  revalidatePath("/dashboard/works");
  revalidatePath(`/works/${id}`);
  redirect("/dashboard/works?message=作品を更新しました");
}
