import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  inspectMarketplaceLiveCanary,
  type MarketplaceLiveCanaryEnvironment,
} from "@/lib/checkout-canary";
import type { MarketplaceCheckoutOperationalReadiness } from "@/modules/checkout/domain/marketplace-checkout-operational-readiness";
import {
  assessMarketplaceLiveLaunchReadiness,
  type MarketplaceLiveLaunchProduct,
  type MarketplaceLiveLaunchProfile,
  type MarketplaceLiveLaunchOrder,
  type MarketplaceLiveLaunchWork,
} from "@/modules/checkout/domain/marketplace-live-launch-readiness";
import {
  assertMarketplaceProductionCanaryRuntime,
  type MarketplaceProductionCanaryRuntimeEnvironment,
} from "@/modules/checkout/domain/production-canary-inventory";

type MarketplaceLiveLaunchReadStage =
  "Product" | "Work" | "Participants" | "Orders";

const errorNames: Record<MarketplaceLiveLaunchReadStage, string> = {
  Product: "MarketplaceLiveLaunchProductReadError",
  Work: "MarketplaceLiveLaunchWorkReadError",
  Participants: "MarketplaceLiveLaunchParticipantsReadError",
  Orders: "MarketplaceLiveLaunchOrdersReadError",
};

class MarketplaceLiveLaunchReadError extends Error {
  constructor(stage: MarketplaceLiveLaunchReadStage) {
    super("Marketplace live launch readiness could not be read.");
    this.name = errorNames[stage];
  }
}

export async function loadAdminMarketplaceLiveLaunchReadiness(
  checkout: MarketplaceCheckoutOperationalReadiness,
  environment: NodeJS.ProcessEnv &
    MarketplaceLiveCanaryEnvironment &
    MarketplaceProductionCanaryRuntimeEnvironment = process.env,
  now = Date.now(),
) {
  const canary = inspectMarketplaceLiveCanary(environment, now);
  if (
    !checkout.ready ||
    checkout.mode !== "live" ||
    !canary.enabled ||
    !canary.target
  ) {
    return assessMarketplaceLiveLaunchReadiness({
      checkout,
      target: null,
    });
  }

  assertMarketplaceProductionCanaryRuntime(environment);
  const target = canary.target;
  const admin = createAdminClient();
  const productResult = await admin
    .from("digital_products")
    .select("id,work_id,creator_id,price,status,file_url")
    .eq("id", target.productId)
    .limit(2);
  if (productResult.error) {
    throw new MarketplaceLiveLaunchReadError("Product");
  }
  const products = (productResult.data ?? []) as MarketplaceLiveLaunchProduct[];
  const workId =
    products.length === 1 && typeof products[0].work_id === "string"
      ? products[0].work_id
      : null;

  let work: MarketplaceLiveLaunchWork | null = null;
  if (workId) {
    const workResult = await admin
      .from("works")
      .select(
        "id,creator_id,status,is_public,content_class,source_project_id,current_publication_id",
      )
      .eq("id", workId)
      .limit(2);
    if (workResult.error) {
      throw new MarketplaceLiveLaunchReadError("Work");
    }
    const works = (workResult.data ?? []) as MarketplaceLiveLaunchWork[];
    work = works.length === 1 ? works[0] : null;
  }

  const participantsResult = await admin
    .from("profiles")
    .select("id,role")
    .in("id", [target.sellerProfileId, target.buyerProfileId])
    .limit(3);
  if (participantsResult.error) {
    throw new MarketplaceLiveLaunchReadError("Participants");
  }

  const ordersResult = await admin
    .from("orders")
    .select("id,status")
    .eq("product_id", target.productId)
    .eq("creator_id", target.sellerProfileId)
    .eq("buyer_profile_id", target.buyerProfileId)
    .eq("payment_mode", "live")
    .in("status", ["pending", "paid"])
    .limit(2);
  if (ordersResult.error) {
    throw new MarketplaceLiveLaunchReadError("Orders");
  }

  return assessMarketplaceLiveLaunchReadiness({
    checkout,
    target,
    products,
    work,
    profiles: (participantsResult.data ?? []) as MarketplaceLiveLaunchProfile[],
    existingOrders: (ordersResult.data ?? []) as MarketplaceLiveLaunchOrder[],
  });
}
