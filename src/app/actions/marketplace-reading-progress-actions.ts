"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  workId: z.string().uuid(),
  publicationId: z.string().uuid(),
  pageNumber: z.number().int().positive(),
});

export async function saveMarketplaceReadingProgress(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false as const };
    const { error } = await supabase.rpc("save_marketplace_reading_progress", {
      p_work_id: parsed.data.workId,
      p_publication_id: parsed.data.publicationId,
      p_page_number: parsed.data.pageNumber,
    });
    if (error) return { ok: false as const };
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}
