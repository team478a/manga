"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  CLOUD_ADULT_RESEARCH_TERMS_VERSION,
  cloudAdultResearchFeatureEnabled,
  getCloudAdultResearchAccess,
} from "@/lib/cloud-adult-research";
import { createClient } from "@/lib/supabase/server";

export async function acceptCloudAdultResearchTermsAction(
  formData: FormData,
) {
  if (!cloudAdultResearchFeatureEnabled())
    redirect("/dashboard/research?error=成人向け市場分析は現在停止中です");
  const { profile } = await requireProfile();
  const access = await getCloudAdultResearchAccess(profile.id);
  if (!access.entitlement || access.entitlement.status !== "approved")
    redirect(
      "/dashboard/research/adult-access?error=成人向け市場分析の利用許可が必要です",
    );
  if (
    formData.get("ageConfirmed") !== "yes" ||
    formData.get("termsAccepted") !== "yes"
  )
    redirect(
      "/dashboard/research/adult-access?error=18歳以上の確認と専用規約への同意が必要です",
    );

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cloud_adult_research_consents")
    .upsert(
      {
        profile_id: profile.id,
        age_confirmed_at: now,
        terms_version: CLOUD_ADULT_RESEARCH_TERMS_VERSION,
        terms_accepted_at: now,
        withdrawn_at: null,
        updated_at: now,
      },
      { onConflict: "profile_id" },
    );
  if (error)
    redirect(
      "/dashboard/research/adult-access?error=利用確認を保存できませんでした",
    );
  revalidatePath("/dashboard/research");
  revalidatePath("/dashboard/research/new");
  redirect(
    "/dashboard/research/adult-access?message=成人向け市場分析を利用できるようになりました",
  );
}

export async function withdrawCloudAdultResearchTermsAction() {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cloud_adult_research_consents")
    .update({
      withdrawn_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", profile.id);
  if (error)
    redirect(
      "/dashboard/research/adult-access?error=利用同意を解除できませんでした",
    );
  revalidatePath("/dashboard/research");
  revalidatePath("/dashboard/research/new");
  redirect(
    "/dashboard/research/adult-access?message=成人向け市場分析の利用同意を解除しました",
  );
}
