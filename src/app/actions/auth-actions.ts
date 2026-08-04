"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { formText } from "./shared/form-data";

const passwordSchema = z.string().min(8);

export async function signUp(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect(encodeURI("/signup?error=Supabaseの環境変数を設定すると新規登録できます。"));
  }

  const schema = z
    .object({
      email: z.string().email(),
      password: passwordSchema,
      passwordConfirmation: passwordSchema,
      displayName: z.string().min(1),
    })
    .refine((value) => value.password === value.passwordConfirmation, {
      path: ["passwordConfirmation"],
    });
  const input = schema.safeParse({
    email: formText(formData, "email"),
    password: formText(formData, "password"),
    passwordConfirmation: formText(formData, "passwordConfirmation"),
    displayName: formText(formData, "displayName"),
  });

  if (!input.success) {
    redirect(
      `/signup?error=${encodeURIComponent("入力内容を確認してください。パスワードは8文字以上で、確認欄にも同じ内容を入力してください。")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: input.data.email,
    password: input.data.password,
    options: {
      data: {
        display_name: input.data.displayName,
      },
    },
  });

  if (error) {
    redirect(
      `/signup?error=${encodeURIComponent("新規登録できませんでした。入力内容または登録状況を確認してください。")}`,
    );
  }
  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect(encodeURI("/login?error=Supabaseの環境変数を設定するとログインできます。"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: formText(formData, "email"),
    password: formText(formData, "password"),
  });

  if (error)
    redirect(
      `/login?error=${encodeURIComponent("メールアドレスまたはパスワードを確認してください")}`,
    );
  redirect("/dashboard");
}

async function requestOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host?.startsWith("localhost")
        ? "http"
        : "https";

  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    return null;
  }

  return `${protocol}://${host}`;
}

export async function requestPasswordReset(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("Supabaseの環境変数を設定するとパスワードを再設定できます。")}`,
    );
  }

  const email = z.string().email().safeParse(formText(formData, "email"));
  if (!email.success) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("メールアドレスを確認してください。")}`,
    );
  }

  const origin = await requestOrigin();
  if (!origin) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("再設定用URLを作成できませんでした。時間をおいて再度お試しください。")}`,
    );
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  redirect(
    `/login?message=${encodeURIComponent("登録済みの場合は、パスワード再設定メールを送信しました。メールをご確認ください。")}`,
  );
}

export async function updatePassword(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect(
      `/update-password?error=${encodeURIComponent("Supabaseの環境変数を設定するとパスワードを更新できます。")}`,
    );
  }

  const input = z
    .object({
      password: passwordSchema,
      passwordConfirmation: passwordSchema,
    })
    .refine((value) => value.password === value.passwordConfirmation, {
      path: ["passwordConfirmation"],
    })
    .safeParse({
      password: formText(formData, "password"),
      passwordConfirmation: formText(formData, "passwordConfirmation"),
    });

  if (!input.success) {
    redirect(
      `/update-password?error=${encodeURIComponent("パスワードは8文字以上で、確認欄にも同じ内容を入力してください。")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("再設定リンクが無効または期限切れです。もう一度メールを送信してください。")}`,
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: input.data.password,
  });
  if (error) {
    redirect(
      `/update-password?error=${encodeURIComponent("パスワードを更新できませんでした。再設定メールからやり直してください。")}`,
    );
  }

  await supabase.auth.signOut();
  redirect(
    `/login?message=${encodeURIComponent("パスワードを更新しました。新しいパスワードでログインしてください。")}`,
  );
}

export async function signOut() {
  if (!hasSupabaseEnv()) redirect("/");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
