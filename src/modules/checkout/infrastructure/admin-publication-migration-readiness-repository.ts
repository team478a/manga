import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  assessMarketplacePublicationMigrationReadiness,
  maximumMarketplacePublicationMigrationInventoryRows,
  type MarketplacePublicationMigrationArtifactState,
  type MarketplacePublicationMigrationCloudWork,
  type MarketplacePublicationMigrationDependencyState,
  type MarketplacePublicationMigrationProduct,
} from "@/modules/checkout/domain/publication-migration-readiness";
import {
  assertMarketplaceProductionCanaryRuntime,
  type MarketplaceProductionCanaryRuntimeEnvironment,
} from "@/modules/checkout/domain/production-canary-inventory";

const missingSchemaCodes = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

class MarketplacePublicationMigrationReadError extends Error {
  constructor() {
    super("Marketplace publication migration readiness could not be read.");
    this.name = "MarketplacePublicationMigrationReadError";
  }
}

const isMissingSchemaError = (error: { code?: string } | null) =>
  Boolean(error?.code && missingSchemaCodes.has(error.code));

export async function loadAdminMarketplacePublicationMigrationReadiness(
  environment: MarketplaceProductionCanaryRuntimeEnvironment = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
) {
  assertMarketplaceProductionCanaryRuntime(environment);
  const admin = createAdminClient();

  const probeSchema = async (relation: string, columns: string) => {
    const result = await admin.from(relation).select(columns).limit(0);
    if (!result.error) return true;
    if (isMissingSchemaError(result.error)) return false;
    throw new MarketplacePublicationMigrationReadError();
  };

  const dependencyDefinitions = {
    works: ["works", "id,creator_id,source_project_id,status,is_public"],
    digitalProducts: [
      "digital_products",
      "id,creator_id,work_id,status,file_url,price",
    ],
    cloudProjects: [
      "cloud_projects",
      "id,owner_profile_id,content_class,deleted_at,title,description,age_rating",
    ],
    cloudProjectCheckpoints: [
      "cloud_project_checkpoints",
      "id,project_id,created_by_profile_id,kind,manifest_sha256,page_count",
    ],
    cloudProjectCheckpointPages: [
      "cloud_project_checkpoint_pages",
      "checkpoint_id,page_number",
    ],
    profiles: ["profiles", "id"],
  } as const;
  const artifactDefinitions = {
    workPublicationColumns: [
      "works",
      "current_publication_id,published_version,published_at",
    ],
    publicationsTable: ["cloud_work_publications", "id"],
    publicationPagesTable: ["cloud_work_publication_pages", "publication_id"],
  } as const;

  const dependencyEntries = await Promise.all(
    Object.entries(dependencyDefinitions).map(async ([key, [relation, columns]]) => [
      key,
      await probeSchema(relation, columns),
    ]),
  );
  const artifactEntries = await Promise.all(
    Object.entries(artifactDefinitions).map(async ([key, [relation, columns]]) => [
      key,
      await probeSchema(relation, columns),
    ]),
  );
  const dependencies = Object.fromEntries(
    dependencyEntries,
  ) as MarketplacePublicationMigrationDependencyState;
  const artifacts = Object.fromEntries(
    artifactEntries,
  ) as MarketplacePublicationMigrationArtifactState;

  if (!dependencies.works || !dependencies.digitalProducts) {
    return assessMarketplacePublicationMigrationReadiness({
      activeProducts: [],
      artifacts,
      cloudWorks: [],
      dependencies,
    });
  }

  const [cloudWorksResult, activeProductsResult] = await Promise.all([
    admin
      .from("works")
      .select("id,source_project_id,status,is_public")
      .not("source_project_id", "is", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(maximumMarketplacePublicationMigrationInventoryRows + 1),
    admin
      .from("digital_products")
      .select("id,work_id,status")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(maximumMarketplacePublicationMigrationInventoryRows + 1),
  ]);
  if (cloudWorksResult.error || activeProductsResult.error) {
    throw new MarketplacePublicationMigrationReadError();
  }

  return assessMarketplacePublicationMigrationReadiness({
    activeProducts: (activeProductsResult.data ??
      []) as MarketplacePublicationMigrationProduct[],
    artifacts,
    cloudWorks: (cloudWorksResult.data ??
      []) as MarketplacePublicationMigrationCloudWork[],
    dependencies,
  });
}
