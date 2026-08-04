"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formText } from "./shared/form-data";

export async function createGoodsRequest(formData: FormData) {
  const { profile } = await requireProfile();
  const workId = formText(formData, "workId");
  const productType = formText(formData, "productType");
  if (!workId || !productType) {
    redirect(
      encodeURI("/dashboard/goods-requests/new?error=作品とグッズの種類を選んでください"),
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
    redirect(encodeURI("/dashboard/goods-requests/new?error=自分の作品だけ申請できます"));
  }
  const { error } = await supabase.from("goods_requests").insert({
    work_id: workId,
    creator_id: profile.id,
    product_type: productType,
    note: formText(formData, "note"),
    status: "pending",
  });
  if (error) {
    redirect(
      `/dashboard/goods-requests/new?error=${encodeURIComponent("グッズ販売申請を登録できませんでした")}`,
    );
  }
  revalidatePath("/dashboard/goods-requests");
  redirect(encodeURI("/dashboard/goods-requests?message=グッズ販売申請を受け付けました"));
}

export async function updateGoodsRequestAdmin(formData: FormData) {
  await requireAdmin();
  const id = formText(formData, "id");
  const status = formText(formData, "status");
  const allowedStatuses = [
    "pending",
    "approved",
    "rejected",
    "in_progress",
    "completed",
  ];
  if (!id || !allowedStatuses.includes(status)) {
    redirect(encodeURI("/admin/goods-requests?error=状態を確認してください"));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("goods_requests")
    .update({
      status,
      admin_note: formText(formData, "adminNote"),
    })
    .eq("id", id);
  if (error) {
    redirect(
      `/admin/goods-requests?error=${encodeURIComponent("グッズ申請を更新できませんでした")}`,
    );
  }
  revalidatePath("/admin/goods-requests");
  redirect(encodeURI("/admin/goods-requests?message=グッズ申請を更新しました"));
}
