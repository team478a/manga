import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type MarketplaceFavoriteRow = {
  work_id: string;
  created_at: string;
};

export type MarketplaceFavoriteSnapshot = {
  availability: "ready" | "signed-out" | "unavailable";
  rows: MarketplaceFavoriteRow[];
  workIds: Set<string>;
};

export async function loadMarketplaceFavoriteSnapshot(
  workIds?: string[],
): Promise<MarketplaceFavoriteSnapshot> {
  const { profile } = await getCurrentProfile();
  if (!profile) {
    return { availability: "signed-out", rows: [], workIds: new Set() };
  }
  if (workIds?.length === 0) {
    return { availability: "ready", rows: [], workIds: new Set() };
  }

  const supabase = await createClient();
  let query = supabase
    .from("marketplace_favorites")
    .select("work_id,created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });
  if (workIds) query = query.in("work_id", workIds);
  const { data, error } = await query.returns<MarketplaceFavoriteRow[]>();
  if (error) {
    return { availability: "unavailable", rows: [], workIds: new Set() };
  }
  const rows = data ?? [];
  return {
    availability: "ready",
    rows,
    workIds: new Set(rows.map((row) => row.work_id)),
  };
}
