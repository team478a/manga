import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export default async function ResearchAiAdminPage() {
  await requireAdmin();
  redirect("/admin/provider-settings#openai");
}
