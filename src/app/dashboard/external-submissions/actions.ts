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
  const submissionId = z.string().uuid().parse(formData.get("submissionId"));
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
