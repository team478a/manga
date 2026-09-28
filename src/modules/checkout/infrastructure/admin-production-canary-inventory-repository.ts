import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  assessMarketplaceProductionCanaryInventory,
  assertMarketplaceProductionCanaryRuntime,
  maximumMarketplaceProductionCanaryProducts,
  type MarketplaceProductionCanaryProduct,
  type MarketplaceProductionCanaryProfile,
  type MarketplaceProductionCanaryRuntimeEnvironment,
} from "@/modules/checkout/domain/production-canary-inventory";

export async function loadAdminMarketplaceProductionCanaryInventory(
  environment: MarketplaceProductionCanaryRuntimeEnvironment = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
) {
  assertMarketplaceProductionCanaryRuntime(environment);
  const admin = createAdminClient();
  const productsResult = await admin
    .from("digital_products")
    .select(
      "id,creator_id,price,status,file_url,works:work_id(id,creator_id,status,is_public,content_class,source_project_id,current_publication_id)",
    )
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(maximumMarketplaceProductionCanaryProducts + 1);
  if (productsResult.error) throw productsResult.error;

  const products = (productsResult.data ?? []) as MarketplaceProductionCanaryProduct[];
  if (products.length > maximumMarketplaceProductionCanaryProducts) {
    return assessMarketplaceProductionCanaryInventory({
      products,
      profiles: [],
    });
  }

  const sellerIds = [
    ...new Set(
      products.flatMap((product) =>
        typeof product.creator_id === "string" && product.creator_id
          ? [product.creator_id]
          : [],
      ),
    ),
  ];
  let profiles: MarketplaceProductionCanaryProfile[] = [];
  if (sellerIds.length > 0) {
    const profilesResult = await admin
      .from("profiles")
      .select("id,role")
      .in("id", sellerIds)
      .limit(maximumMarketplaceProductionCanaryProducts);
    if (profilesResult.error) throw profilesResult.error;
    profiles = (profilesResult.data ?? []) as MarketplaceProductionCanaryProfile[];
  }

  return assessMarketplaceProductionCanaryInventory({ products, profiles });
}
