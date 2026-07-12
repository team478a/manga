import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getCurrentProfile() {
  if (!hasSupabaseEnv()) return { user: null, profile: null as Profile | null };

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null as Profile | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Profile>();

  return { user, profile };
}

export async function requireProfile() {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!profile) redirect("/signup?message=profile");
  return { user, profile };
}

export async function requireAdmin() {
  const { user, profile } = await requireProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  return { user, profile };
}
