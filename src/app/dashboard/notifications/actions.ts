"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { DomainError, ValidationError } from "@/lib/domain-errors";
import { createClient } from "@/lib/supabase/server";

export async function markCloudAiNotificationReadAction(id: string) {
  const { profile } = await requireProfile();
  const parsedNotificationId = z.string().uuid().safeParse(id);
  if (!parsedNotificationId.success)
    throw new ValidationError("通知IDを確認してください。");
  const notificationId = parsedNotificationId.data;
  const supabase=await createClient();
  const { error } = await supabase.from("cloud_ai_notifications").update({read_at:new Date().toISOString()}).eq("id",notificationId).eq("profile_id",profile.id);
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "通知を既読にできませんでした。",
      { cause: error },
    );
  revalidatePath("/dashboard/notifications");
}

export async function markAllCloudAiNotificationsReadAction() {
  const { profile }=await requireProfile();
  const supabase=await createClient();
  const { error } = await supabase.from("cloud_ai_notifications").update({read_at:new Date().toISOString()}).eq("profile_id",profile.id).is("read_at",null);
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "通知を既読にできませんでした。",
      { cause: error },
    );
  revalidatePath("/dashboard/notifications");
}
