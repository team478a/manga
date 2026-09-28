import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  assessMarketplacePublicationFixationReadiness,
  maximumMarketplacePublicationFixationCheckpointPages,
  maximumMarketplacePublicationFixationCheckpoints,
  maximumMarketplacePublicationFixationProducts,
  maximumMarketplacePublicationFixationWorks,
  type MarketplacePublicationFixationCheckpoint,
  type MarketplacePublicationFixationCheckpointPage,
  type MarketplacePublicationFixationProduct,
  type MarketplacePublicationFixationProject,
  type MarketplacePublicationFixationWork,
} from "@/modules/checkout/domain/publication-fixation-readiness";
import {
  assertMarketplaceProductionCanaryRuntime,
  type MarketplaceProductionCanaryRuntimeEnvironment,
} from "@/modules/checkout/domain/production-canary-inventory";

type ReadStage = "Works" | "Products" | "Projects" | "Checkpoints" | "Pages";

class MarketplacePublicationFixationReadError extends Error {
  constructor(stage: ReadStage) {
    super("Marketplace publication fixation readiness could not be read.");
    this.name = `MarketplacePublicationFixation${stage}ReadError`;
  }
}

export async function loadAdminMarketplacePublicationFixationReadiness(
  environment: MarketplaceProductionCanaryRuntimeEnvironment = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
) {
  assertMarketplaceProductionCanaryRuntime(environment);
  const admin = createAdminClient();
  const [worksResult, productsResult] = await Promise.all([
    admin
      .from("works")
      .select("id,creator_id,source_project_id,current_publication_id,content_class,status,is_public")
      .not("source_project_id", "is", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(maximumMarketplacePublicationFixationWorks + 1),
    admin
      .from("digital_products")
      .select("work_id,creator_id,status")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(maximumMarketplacePublicationFixationProducts + 1),
  ]);
  if (worksResult.error) throw new MarketplacePublicationFixationReadError("Works");
  if (productsResult.error)
    throw new MarketplacePublicationFixationReadError("Products");
  const works = (worksResult.data ?? []) as MarketplacePublicationFixationWork[];
  const products = (productsResult.data ??
    []) as MarketplacePublicationFixationProduct[];
  if (
    works.length > maximumMarketplacePublicationFixationWorks ||
    products.length > maximumMarketplacePublicationFixationProducts
  ) {
    return assessMarketplacePublicationFixationReadiness({ products, works });
  }

  const projectIds = [
    ...new Set(
      works.flatMap((work) =>
        typeof work.source_project_id === "string" && work.source_project_id
          ? [work.source_project_id]
          : [],
      ),
    ),
  ];
  if (projectIds.length === 0) {
    return assessMarketplacePublicationFixationReadiness({ products, works });
  }
  const [projectsResult, checkpointsResult] = await Promise.all([
    admin
      .from("cloud_projects")
      .select("id,owner_profile_id,content_class,deleted_at")
      .in("id", projectIds)
      .limit(maximumMarketplacePublicationFixationWorks),
    admin
      .from("cloud_project_checkpoints")
      .select("id,project_id,created_by_profile_id,kind,page_count,manifest_sha256")
      .in("project_id", projectIds)
      .eq("kind", "release")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(maximumMarketplacePublicationFixationCheckpoints + 1),
  ]);
  if (projectsResult.error)
    throw new MarketplacePublicationFixationReadError("Projects");
  if (checkpointsResult.error)
    throw new MarketplacePublicationFixationReadError("Checkpoints");
  const projects = (projectsResult.data ??
    []) as MarketplacePublicationFixationProject[];
  const checkpoints = (checkpointsResult.data ??
    []) as MarketplacePublicationFixationCheckpoint[];
  if (checkpoints.length > maximumMarketplacePublicationFixationCheckpoints) {
    return assessMarketplacePublicationFixationReadiness({
      checkpoints,
      products,
      projects,
      works,
    });
  }

  const checkpointIds = checkpoints.flatMap((checkpoint) =>
    typeof checkpoint.id === "string" && checkpoint.id ? [checkpoint.id] : [],
  );
  let checkpointPages: MarketplacePublicationFixationCheckpointPage[] = [];
  if (checkpointIds.length > 0) {
    const pagesResult = await admin
      .from("cloud_project_checkpoint_pages")
      .select("checkpoint_id,page_number")
      .in("checkpoint_id", checkpointIds)
      .order("checkpoint_id", { ascending: true })
      .order("page_number", { ascending: true })
      .limit(maximumMarketplacePublicationFixationCheckpointPages + 1);
    if (pagesResult.error)
      throw new MarketplacePublicationFixationReadError("Pages");
    checkpointPages = (pagesResult.data ??
      []) as MarketplacePublicationFixationCheckpointPage[];
  }

  return assessMarketplacePublicationFixationReadiness({
    checkpointPages,
    checkpoints,
    products,
    projects,
    works,
  });
}
