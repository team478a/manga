"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formText } from "./shared/form-data";

export async function updateProfile(formData: FormData) {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: formText(formData, "displayName"),
      bio: formText(formData, "bio"),
    })
    .eq("id", profile.id);
  if (error) redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard");
  redirect("/dashboard?message=保存しました");
}
