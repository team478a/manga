"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  marketplaceFavoriteFeedbackPath,
  resolveMarketplaceFavoriteReturnPath,
} from "@/lib/marketplace-favorite-routing";
import { createClient } from "@/lib/supabase/server";
import { formText } from "./shared/form-data";

const favoriteInputSchema = z.object({
  action: z.enum(["add", "remove"]),
  workId: z.string().uuid(),
});

export async function updateMarketplaceFavorite(formData: FormData) {
  const parsed = favoriteInputSchema.safeParse({
    action: formText(formData, "action"),
    workId: formText(formData, "workId"),
  });
  if (!parsed.success) redirect("/works?favorite_error=作品を確認してください");

  const returnPath = resolveMarketplaceFavoriteReturnPath(
    formText(formData, "returnTo"),
    parsed.data.workId,
  );
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();
  if (profileError || !profile) {
    redirect(
      marketplaceFavoriteFeedbackPath(
        returnPath,
        "favorite_error",
        "アカウントを確認できませんでした",
      ),
    );
  }

  if (parsed.data.action === "add") {
    const { data: work, error: workError } = await supabase
      .from("works")
      .select("id")
      .eq("id", parsed.data.workId)
      .eq("is_public", true)
      .eq("content_class", "general")
      .maybeSingle<{ id: string }>();
    if (workError || !work) {
      redirect(
        marketplaceFavoriteFeedbackPath(
          returnPath,
          "favorite_error",
          "公開作品を確認できませんでした",
        ),
      );
    }
    const { error } = await supabase.from("marketplace_favorites").insert({
      profile_id: profile.id,
      work_id: work.id,
    });
    if (error && error.code !== "23505") {
      redirect(
        marketplaceFavoriteFeedbackPath(
          returnPath,
          "favorite_error",
          "あとで読むへ追加できませんでした",
        ),
      );
    }
  } else {
    const { error } = await supabase
      .from("marketplace_favorites")
      .delete()
      .eq("profile_id", profile.id)
      .eq("work_id", parsed.data.workId);
    if (error) {
      redirect(
        marketplaceFavoriteFeedbackPath(
          returnPath,
          "favorite_error",
          "あとで読むから解除できませんでした",
        ),
      );
    }
  }

  revalidatePath("/");
  revalidatePath("/works");
  revalidatePath(`/works/${parsed.data.workId}`);
  revalidatePath("/dashboard/favorites");
  redirect(
    marketplaceFavoriteFeedbackPath(
      returnPath,
      "favorite_message",
      parsed.data.action === "add"
        ? "あとで読むへ追加しました"
        : "あとで読むから解除しました",
    ),
  );
}
