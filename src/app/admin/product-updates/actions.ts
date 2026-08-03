"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
  details: z.string().trim().max(5000),
  category: z.enum(["release", "improvement", "fix", "maintenance"]),
  actionUrl: z.string().trim().max(500).refine(
    (value) => !value || value.startsWith("/") || value.startsWith("https://"),
    "リンクを確認してください",
  ),
  publishNow: z.boolean(),
});

const stateSchema = z.object({
  updateId: z.string().uuid(),
  operation: z.enum(["publish", "unpublish", "archive"]),
});

export async function createProductUpdateAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const parsed = updateSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    details: formData.get("details"),
    category: formData.get("category"),
    actionUrl: formData.get("actionUrl"),
    publishNow: formData.get("publishNow") === "on",
  });
  if (!parsed.success) redirect("/admin/product-updates?error=更新情報の入力内容を確認してください");
  const { error } = await createAdminClient().from("cloud_product_updates").insert({
    title: parsed.data.title,
    summary: parsed.data.summary,
    details: parsed.data.details || null,
    category: parsed.data.category,
    action_url: parsed.data.actionUrl || null,
    published_at: parsed.data.publishNow ? new Date().toISOString() : null,
    created_by_profile_id: profile.id,
  });
  if (error) redirect("/admin/product-updates?error=更新情報を保存できませんでした。migrationを確認してください");
  revalidatePath("/dashboard");
  revalidatePath("/admin/product-updates");
  redirect("/admin/product-updates?message=更新情報を保存しました");
}

export async function changeProductUpdateStateAction(formData: FormData) {
  await requireAdmin();
  const parsed = stateSchema.safeParse({
    updateId: formData.get("updateId"),
    operation: formData.get("operation"),
  });
  if (!parsed.success) redirect("/admin/product-updates?error=更新対象を確認してください");
  const now = new Date().toISOString();
  const values = parsed.data.operation === "publish"
    ? { published_at: now, archived_at: null, updated_at: now }
    : parsed.data.operation === "unpublish"
      ? { published_at: null, updated_at: now }
      : { archived_at: now, updated_at: now };
  const { error } = await createAdminClient()
    .from("cloud_product_updates")
    .update(values)
    .eq("id", parsed.data.updateId);
  if (error) redirect("/admin/product-updates?error=公開状態を変更できませんでした");
  revalidatePath("/dashboard");
  revalidatePath("/admin/product-updates");
  redirect("/admin/product-updates?message=公開状態を更新しました");
}
