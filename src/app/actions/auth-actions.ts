"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { formText } from "./shared/form-data";

export async function signUp(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/signup?error=Supabaseの環境変数を設定すると新規登録できます。");
  }
  const input = z
    .object({
      email: z.string().email(),
      password: z.string().min(6),
      displayName: z.string().min(1),
    })
    .safeParse({
      email: formText(formData, "email"),
      password: formText(formData, "password"),
      displayName: formText(formData, "displayName"),
    });
  if (!input.success) redirect("/signup?error=入力内容を確認してください");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: input.data.email,
    password: input.data.password,
    options: { data: { display_name: input.data.displayName } },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/login?error=Supabaseの環境変数を設定するとログインできます。");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: formText(formData, "email"),
    password: formText(formData, "password"),
  });
  if (error) {
    redirect(
      `/login?error=${encodeURIComponent("メールアドレスまたはパスワードを確認してください")}`,
    );
  }
  redirect("/dashboard");
}

export async function signOut() {
  if (!hasSupabaseEnv()) redirect("/");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
