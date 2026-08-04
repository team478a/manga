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

const editSchema = updateSchema.omit({ publishNow: true }).extend({
  updateId: z.string().uuid(),
});

const productUpdatesTarget = (kind: "message" | "error", text: string) =>
  `/admin/product-updates?${kind}=${encodeURIComponent(text)}`;

const productUpdateEditTarget = (
  updateId: string,
  kind: "message" | "error",
  text: string,
) => `/admin/product-updates/${updateId}/edit?${kind}=${encodeURIComponent(text)}`;

type RecentProductUpdate = {
  title: string;
  summary: string;
  details: string | null;
  category: "release" | "improvement" | "fix" | "maintenance";
  action_url: string | null;
};

const isSameProductUpdate = (
  update: RecentProductUpdate,
  input: z.infer<typeof updateSchema>,
) =>
  update.title === input.title &&
  update.summary === input.summary &&
  (update.details ?? "") === input.details &&
  update.category === input.category &&
  (update.action_url ?? "") === input.actionUrl;

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
  if (!parsed.success) redirect(productUpdatesTarget("error", "更新情報の入力内容を確認してください"));

  // PendingSubmitButton prevents repeated clicks in the browser. This server-side
  // check also covers form resubmission and browser/network retries.
  try {
    const duplicateWindowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const duplicateResult = await createAdminClient()
      .from("cloud_product_updates")
      .select("title,summary,details,category,action_url")
      .eq("created_by_profile_id", profile.id)
      .is("archived_at", null)
      .gte("created_at", duplicateWindowStart)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<RecentProductUpdate[]>();

    if (duplicateResult.error) {
      redirect(productUpdatesTarget("error", "二重登録の確認ができませんでした。時間をおいてもう一度お試しください"));
    }
    if ((duplicateResult.data ?? []).some((update) => isSameProductUpdate(update, parsed.data))) {
      redirect(productUpdatesTarget("message", "同じ更新情報はすでに保存されています"));
    }
  } catch (error) {
    // Next.js redirects are thrown values and must keep propagating.
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(productUpdatesTarget("error", "二重登録の確認ができませんでした。時間をおいてもう一度お試しください"));
  }

  let saveFailed = false;
  try {
    const { error } = await createAdminClient().from("cloud_product_updates").insert({
      title: parsed.data.title,
      summary: parsed.data.summary,
      details: parsed.data.details || null,
      category: parsed.data.category,
      action_url: parsed.data.actionUrl || null,
      published_at: parsed.data.publishNow ? new Date().toISOString() : null,
      created_by_profile_id: profile.id,
    });
    saveFailed = Boolean(error);
  } catch {
    saveFailed = true;
  }
  if (saveFailed) redirect(productUpdatesTarget("error", "更新情報を保存できませんでした。設定を確認してもう一度お試しください"));
  revalidatePath("/dashboard");
  revalidatePath("/admin/product-updates");
  redirect(productUpdatesTarget("message", "更新情報を保存しました"));
}

export async function changeProductUpdateStateAction(formData: FormData) {
  await requireAdmin();
  const parsed = stateSchema.safeParse({
    updateId: formData.get("updateId"),
    operation: formData.get("operation"),
  });
  if (!parsed.success) redirect(productUpdatesTarget("error", "更新対象を確認してください"));
  const now = new Date().toISOString();
  const values = parsed.data.operation === "publish"
    ? { published_at: now, archived_at: null, updated_at: now }
    : parsed.data.operation === "unpublish"
      ? { published_at: null, updated_at: now }
      : { archived_at: now, updated_at: now };
  let updateFailed = false;
  try {
    const { error } = await createAdminClient()
      .from("cloud_product_updates")
      .update(values)
      .eq("id", parsed.data.updateId);
    updateFailed = Boolean(error);
  } catch {
    updateFailed = true;
  }
  if (updateFailed) redirect(productUpdatesTarget("error", "公開状態を変更できませんでした。時間をおいてもう一度お試しください"));
  revalidatePath("/dashboard");
  revalidatePath("/admin/product-updates");
  redirect(productUpdatesTarget("message", "公開状態を更新しました"));
}

export async function editProductUpdateAction(formData: FormData) {
  await requireAdmin();
  const parsed = editSchema.safeParse({
    updateId: formData.get("updateId"),
    title: formData.get("title"),
    summary: formData.get("summary"),
    details: formData.get("details"),
    category: formData.get("category"),
    actionUrl: formData.get("actionUrl"),
  });
  if (!parsed.success) {
    redirect(productUpdatesTarget("error", "編集内容を確認してください"));
  }

  let updateFailed = false;
  try {
    const result = await createAdminClient()
      .from("cloud_product_updates")
      .update({
        title: parsed.data.title,
        summary: parsed.data.summary,
        details: parsed.data.details || null,
        category: parsed.data.category,
        action_url: parsed.data.actionUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.updateId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    updateFailed = Boolean(result.error || !result.data);
  } catch {
    updateFailed = true;
  }

  if (updateFailed) {
    redirect(productUpdateEditTarget(
      parsed.data.updateId,
      "error",
      "更新情報を編集できませんでした。公開状態を確認してもう一度お試しください",
    ));
  }
  revalidatePath("/dashboard");
  revalidatePath("/admin/product-updates");
  revalidatePath(`/admin/product-updates/${parsed.data.updateId}/edit`);
  redirect(productUpdatesTarget("message", "更新情報を編集しました"));
}
