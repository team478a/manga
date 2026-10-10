"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { cloudCreatorContext } from "@/modules/cloud-creator/auth-context";

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(5000),
  ageRating: z.enum(["全年齢", "12歳以上", "15歳以上"]),
  sourceFormat: z.enum(["pdf", "zip", "images"]),
});

const submissionIdSchema = z.string().uuid();

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function createExternalSubmissionAction(formData: FormData) {
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    ageRating: formData.get("ageRating"),
    sourceFormat: formData.get("sourceFormat"),
  });
  if (!parsed.success)
    redirect(`/dashboard/external-submissions?error=${encodeURIComponent("入力内容を確認してください")}`);
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("create_external_work_submission", {
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_age_rating: parsed.data.ageRating,
    p_source_format: parsed.data.sourceFormat,
  });
  if (result.error || !result.data)
    redirect(`/dashboard/external-submissions?error=${encodeURIComponent("応募下書きを作成できませんでした")}`);
  redirect(`/dashboard/external-submissions/${result.data}`);
}

export async function startExternalSubmissionUploadAction(formData: FormData) {
  const submissionId = submissionIdSchema.parse(formData.get("submissionId"));
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("transition_external_work_submission", {
    p_submission_id: submissionId,
    p_status: "uploading",
    p_reason_code: null,
  });
  if (result.error)
    redirect(
      `/dashboard/external-submissions/${submissionId}?error=${encodeURIComponent("Uploadを開始できませんでした")}`,
    );
  redirect(`/dashboard/external-submissions/${submissionId}`);
}

export async function submitExternalWorkForReviewAction(formData: FormData) {
  const submissionId = submissionIdSchema.parse(formData.get("submissionId"));
  const parsed = z.coerce.number().int().nonnegative().safeParse(formData.get("price"));
  if (!parsed.success)
    redirect(`/dashboard/external-submissions/${submissionId}?error=${encodeURIComponent("価格を0円以上の整数で入力してください")}`);
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("submit_external_work_for_review", {
    p_submission_id: submissionId,
    p_price: parsed.data,
    p_declaration_version: "external-marketplace-v1",
    p_rights_holder_confirmed: checked(formData, "rightsHolderConfirmed"),
    p_third_party_permissions_confirmed: checked(formData, "thirdPartyPermissionsConfirmed"),
    p_ai_use_disclosed: checked(formData, "aiUseDisclosed"),
    p_adult_content_absent: checked(formData, "adultContentAbsent"),
  });
  if (result.error)
    redirect(`/dashboard/external-submissions/${submissionId}?error=${encodeURIComponent("権利申告と価格を確認し、再度お試しください")}`);
  redirect(`/dashboard/external-submissions/${submissionId}`);
}

export async function publishExternalMarketplaceListingAction(formData: FormData) {
  const submissionId = submissionIdSchema.parse(formData.get("submissionId"));
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("publish_external_marketplace_listing", { p_submission_id: submissionId });
  if (result.error)
    redirect(`/dashboard/external-submissions/${submissionId}?error=${encodeURIComponent("公開条件を確認できませんでした")}`);
  redirect(`/dashboard/external-submissions/${submissionId}`);
}

export async function withdrawExternalMarketplaceListingAction(formData: FormData) {
  const submissionId = submissionIdSchema.parse(formData.get("submissionId"));
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("withdraw_external_marketplace_listing", { p_submission_id: submissionId });
  if (result.error)
    redirect(`/dashboard/external-submissions/${submissionId}?error=${encodeURIComponent("販売停止に失敗しました")}`);
  redirect(`/dashboard/external-submissions/${submissionId}`);
}
