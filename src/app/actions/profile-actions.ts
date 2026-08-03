"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { firstValidationMessage, profileInputSchema } from "@/lib/creator-input";
import { createClient } from "@/lib/supabase/server";
import { formText } from "./shared/form-data";

export async function updateProfile(formData: FormData) {
  const { profile } = await requireProfile();
  const input = profileInputSchema.safeParse({
    displayName: formText(formData, "displayName"),
    bio: formText(formData, "bio"),
  });
  if (!input.success) {
    redirect(
      `/dashboard/account?error=${encodeURIComponent(firstValidationMessage(input.error))}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.data.displayName,
      bio: input.data.bio,
    })
    .eq("id", profile.id);

  if (error)
    redirect(
      `/dashboard/account?error=${encodeURIComponent("プロフィールを保存できませんでした")}`,
    );
  revalidatePath("/dashboard/account");
  revalidatePath("/dashboard");
  redirect("/dashboard/account?message=プロフィールを保存しました");
}
