"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markCloudAiNotificationReadAction(id: string) {
  const { profile } = await requireProfile();
  const notificationId=z.string().uuid().parse(id);
  const supabase=await createClient();
  await supabase.from("cloud_ai_notifications").update({read_at:new Date().toISOString()}).eq("id",notificationId).eq("profile_id",profile.id);
  revalidatePath("/dashboard/notifications");
}

export async function markAllCloudAiNotificationsReadAction() {
  const { profile }=await requireProfile();
  const supabase=await createClient();
  await supabase.from("cloud_ai_notifications").update({read_at:new Date().toISOString()}).eq("profile_id",profile.id).is("read_at",null);
  revalidatePath("/dashboard/notifications");
}
