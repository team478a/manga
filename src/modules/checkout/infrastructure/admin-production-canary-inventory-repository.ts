import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  attachMarketplaceProductionCanaryWorks,
  assessMarketplaceProductionCanaryInventory,
  assertMarketplaceProductionCanaryRuntime,
  maximumMarketplaceProductionCanaryProducts,
  maximumMarketplaceProductionCanaryWorks,
  type MarketplaceProductionCanaryProduct,
  type MarketplaceProductionCanaryProfile,
  type MarketplaceProductionCanaryRuntimeEnvironment,
  type MarketplaceProductionCanaryWork,
} from "@/modules/checkout/domain/production-canary-inventory";

type MarketplaceProductionCanaryReadStage =
  | "Products"
  | "Works"
  | "SourceWorks"
  | "Profiles";

const marketplaceProductionCanaryReadErrorNames: Record<
  MarketplaceProductionCanaryReadStage,
  string
> = {
  Products: "MarketplaceProductionCanaryProductsReadError",
  Works: "MarketplaceProductionCanaryWorksReadError",
  SourceWorks: "MarketplaceProductionCanarySourceWorksReadError",
  Profiles: "MarketplaceProductionCanaryProfilesReadError",
};

class MarketplaceProductionCanaryReadError extends Error {
  constructor(stage: MarketplaceProductionCanaryReadStage) {
    super("Marketplace Production canary inventory could not be read.");
    this.name = marketplaceProductionCanaryReadErrorNames[stage];
  }
}

const marketplaceProductionCanaryLegacyWorkColumns =
  "id,creator_id,status,is_public,content_class,source_project_id";
const marketplaceProductionCanaryWorkColumns =
  `${marketplaceProductionCanaryLegacyWorkColumns},current_publication_id`;

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
    .select("id,work_id,creator_id,price,status,file_url")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(maximumMarketplaceProductionCanaryProducts + 1);
  if (productsResult.error) {
    throw new MarketplaceProductionCanaryReadError("Products");
  }

  const rawProducts = (productsResult.data ??
    []) as MarketplaceProductionCanaryProduct[];
  if (rawProducts.length > maximumMarketplaceProductionCanaryProducts) {
    return assessMarketplaceProductionCanaryInventory({
      products: rawProducts,
      profiles: [],
    });
  }

  const workIds = [
    ...new Set(
      rawProducts.flatMap((product) =>
        typeof product.work_id === "string" && product.work_id
          ? [product.work_id]
          : [],
      ),
    ),
  ];
  let works: MarketplaceProductionCanaryWork[] = [];
  if (workIds.length > 0) {
    const worksResult = await admin
      .from("works")
      .select(marketplaceProductionCanaryWorkColumns)
      .in("id", workIds)
      .limit(maximumMarketplaceProductionCanaryProducts);
    if (worksResult.error) {
      // Some deployed Marketplace schemas predate Cloud publication pinning.
      // Retry with the legacy least-privilege projection instead of selecting
      // content fields. A Cloud-linked work then lacks current_publication_id
      // and remains ineligible in the domain assessment (fail closed), while a
      // manually registered work can still be audited.
      const legacyWorksResult = await admin
        .from("works")
        .select(marketplaceProductionCanaryLegacyWorkColumns)
        .in("id", workIds)
        .limit(maximumMarketplaceProductionCanaryProducts);
      if (legacyWorksResult.error) {
        throw new MarketplaceProductionCanaryReadError("Works");
      }
      works = (legacyWorksResult.data ?? []) as MarketplaceProductionCanaryWork[];
    } else {
      works = (worksResult.data ?? []) as MarketplaceProductionCanaryWork[];
    }
  }
  const products = attachMarketplaceProductionCanaryWorks(rawProducts, works);

  const sourceWorksResult = await admin
    .from("works")
    .select(marketplaceProductionCanaryWorkColumns)
    .eq("status", "published")
    .eq("is_public", true)
    .eq("content_class", "general")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(maximumMarketplaceProductionCanaryWorks + 1);
  let sourceWorks: MarketplaceProductionCanaryWork[];
  if (sourceWorksResult.error) {
    const legacySourceWorksResult = await admin
      .from("works")
      .select(marketplaceProductionCanaryLegacyWorkColumns)
      .eq("status", "published")
      .eq("is_public", true)
      .eq("content_class", "general")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(maximumMarketplaceProductionCanaryWorks + 1);
    if (legacySourceWorksResult.error) {
      throw new MarketplaceProductionCanaryReadError("SourceWorks");
    }
    sourceWorks = (legacySourceWorksResult.data ??
      []) as MarketplaceProductionCanaryWork[];
  } else {
    sourceWorks = (sourceWorksResult.data ??
      []) as MarketplaceProductionCanaryWork[];
  }

  const sellerIds = [
    ...new Set(
      [
        ...products.flatMap((product) =>
          typeof product.creator_id === "string" && product.creator_id
            ? [product.creator_id]
            : [],
        ),
        ...(sourceWorks.length <= maximumMarketplaceProductionCanaryWorks
          ? sourceWorks.flatMap((work) =>
              typeof work.creator_id === "string" && work.creator_id
                ? [work.creator_id]
                : [],
            )
          : []),
      ],
    ),
  ];
  let profiles: MarketplaceProductionCanaryProfile[] = [];
  if (sellerIds.length > 0) {
    const profilesResult = await admin
      .from("profiles")
      .select("id,role")
      .in("id", sellerIds)
      .limit(maximumMarketplaceProductionCanaryProducts);
    if (profilesResult.error) {
      throw new MarketplaceProductionCanaryReadError("Profiles");
    }
    profiles = (profilesResult.data ?? []) as MarketplaceProductionCanaryProfile[];
  }

  return assessMarketplaceProductionCanaryInventory({
    products,
    profiles,
    sourceWorks,
  });
}
