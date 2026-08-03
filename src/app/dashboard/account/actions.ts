"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formText } from "@/app/actions/shared/form-data";

const emailSchema = z.string().trim().email();
const passwordSchema = z
  .object({
    password: z.string().min(8),
    passwordConfirmation: z.string().min(8),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
  });

function accountRedirect(kind: "error" | "message", message: string) {
  return `/dashboard/account?${kind}=${encodeURIComponent(message)}`;
}

export async function updateAccountEmailAction(formData: FormData) {
  const { user } = await requireProfile();
  const parsed = emailSchema.safeParse(formText(formData, "email").toLowerCase());
  if (!parsed.success)
    redirect(accountRedirect("error", "メールアドレスを確認してください。"));
  if (user.email?.toLowerCase() === parsed.data)
    redirect(accountRedirect("message", "現在と同じメールアドレスです。"));

  const { error } = await (await createClient()).auth.updateUser({
    email: parsed.data,
  });
  if (error)
    redirect(
      accountRedirect(
        "error",
        "メールアドレスを変更できませんでした。時間をおいて再度お試しください。",
      ),
    );
  redirect(
    accountRedirect(
      "message",
      "確認メールを送信しました。メール内のリンクを開くと変更が完了します。",
    ),
  );
}

export async function updateAccountPasswordAction(formData: FormData) {
  await requireProfile();
  const parsed = passwordSchema.safeParse({
    password: formText(formData, "password"),
    passwordConfirmation: formText(formData, "passwordConfirmation"),
  });
  if (!parsed.success)
    redirect(
      accountRedirect(
        "error",
        "パスワードは8文字以上で、確認欄にも同じ内容を入力してください。",
      ),
    );

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error)
    redirect(
      accountRedirect(
        "error",
        "パスワードを変更できませんでした。時間をおいて再度お試しください。",
      ),
    );

  await supabase.auth.signOut();
  redirect(
    `/login?message=${encodeURIComponent("パスワードを変更しました。新しいパスワードでログインしてください。")}`,
  );
}
