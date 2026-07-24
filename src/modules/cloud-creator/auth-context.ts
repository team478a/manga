import { createClient } from "@/lib/supabase/server";

export type CloudCreatorClient = Awaited<ReturnType<typeof createClient>>;

export async function cloudCreatorContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("認証が必要です。");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("user_id", user.id)
    .single();
  if (error || !profile) throw new Error("プロフィールが必要です。");
  if (profile.role !== "creator" && profile.role !== "admin") {
    throw new Error(
      "Cloud Creatorを利用するにはクリエイター登録が必要です。",
    );
  }
  return { supabase, user, profile };
}
