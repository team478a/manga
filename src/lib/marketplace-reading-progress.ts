import { createClient } from "@/lib/supabase/server";
import { marketplaceReadingProgressKey } from "@/lib/marketplace-reading-progress-utils";

export {
  marketplaceReadingProgressKey,
  resolveMarketplaceReadingPage,
} from "@/lib/marketplace-reading-progress-utils";

export type MarketplaceReadingProgressRow = {
  work_id: string;
  publication_id: string;
  page_number: number;
  updated_at: string;
};

export type MarketplaceReadingProgressSnapshot = {
  availability: "ready" | "unavailable";
  rows: MarketplaceReadingProgressRow[];
  pagesByPublication: Map<string, number>;
};

export async function loadMarketplaceReadingProgress(
  profileId: string,
  workIds?: string[],
): Promise<MarketplaceReadingProgressSnapshot> {
  if (workIds?.length === 0) {
    return { availability: "ready", rows: [], pagesByPublication: new Map() };
  }
  const supabase = await createClient();
  let query = supabase
    .from("marketplace_reading_progress")
    .select("work_id,publication_id,page_number,updated_at")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });
  if (workIds) query = query.in("work_id", workIds);
  const { data, error } = await query.returns<MarketplaceReadingProgressRow[]>();
  if (error) {
    return { availability: "unavailable", rows: [], pagesByPublication: new Map() };
  }
  const rows = data ?? [];
  return {
    availability: "ready",
    rows,
    pagesByPublication: new Map(
      rows.map((row) => [
        marketplaceReadingProgressKey(row.work_id, row.publication_id),
        Number(row.page_number),
      ]),
    ),
  };
}
