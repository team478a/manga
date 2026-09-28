export const marketplacePublicationMigration = Object.freeze({
  checksumSha256:
    "eaf9d6af5febdad9c8e78c3de80c2181a30afac60f3572a6758d82e1e247b7aa",
  id: "202608140004_cloud_work_publications",
});

export const maximumMarketplacePublicationMigrationInventoryRows = 100;

export type MarketplacePublicationMigrationDependencyState = {
  works: boolean;
  digitalProducts: boolean;
  cloudProjects: boolean;
  cloudProjectCheckpoints: boolean;
  cloudProjectCheckpointPages: boolean;
  profiles: boolean;
};

export type MarketplacePublicationMigrationArtifactState = {
  workPublicationColumns: boolean;
  publicationsTable: boolean;
  publicationPagesTable: boolean;
};

export type MarketplacePublicationMigrationCloudWork = {
  id?: unknown;
  source_project_id?: unknown;
  status?: unknown;
  is_public?: unknown;
};

export type MarketplacePublicationMigrationProduct = {
  id?: unknown;
  work_id?: unknown;
  status?: unknown;
};

export type MarketplacePublicationMigrationCheckId =
  | "dependencies"
  | "pre-apply-state"
  | "inventory-complete"
  | "unpublished-cloud-works"
  | "inactive-cloud-products"
  | "unique-project-work";

export type MarketplacePublicationMigrationReadinessReport = {
  passed: boolean;
  migration: typeof marketplacePublicationMigration;
  state: "not-applied" | "partial" | "already-applied";
  checks: Array<{
    id: MarketplacePublicationMigrationCheckId;
    label: string;
    ready: boolean;
    missing: string[];
  }>;
  counts: {
    activeCloudProducts: number;
    checkedActiveProducts: number;
    checkedCloudWorks: number;
    duplicateCloudProjectMappings: number;
    publicOrPublishedCloudWorks: number;
  };
  safety: {
    identifiersPrinted: false;
    personalDataSelected: false;
    productionMutation: false;
    requestMethods: ["GET"];
    stripeRequest: false;
  };
};

const check = (
  id: MarketplacePublicationMigrationCheckId,
  label: string,
  ready: boolean,
  missing: string,
) => ({
  id,
  label,
  ready,
  missing: ready ? [] : [missing],
});

export function assessMarketplacePublicationMigrationReadiness({
  activeProducts = [],
  artifacts,
  cloudWorks = [],
  dependencies,
}: {
  activeProducts?: MarketplacePublicationMigrationProduct[];
  artifacts: MarketplacePublicationMigrationArtifactState;
  cloudWorks?: MarketplacePublicationMigrationCloudWork[];
  dependencies: MarketplacePublicationMigrationDependencyState;
}): MarketplacePublicationMigrationReadinessReport {
  const artifactValues = Object.values(artifacts);
  const artifactState = artifactValues.every(Boolean)
    ? "already-applied"
    : artifactValues.every((value) => !value)
      ? "not-applied"
      : "partial";
  const inventoryComplete =
    cloudWorks.length <= maximumMarketplacePublicationMigrationInventoryRows &&
    activeProducts.length <= maximumMarketplacePublicationMigrationInventoryRows;
  const inspectedCloudWorks = cloudWorks.slice(
    0,
    maximumMarketplacePublicationMigrationInventoryRows,
  );
  const inspectedActiveProducts = activeProducts.slice(
    0,
    maximumMarketplacePublicationMigrationInventoryRows,
  );
  const cloudWorkIds = new Set(
    inspectedCloudWorks
      .map((work) => work.id)
      .filter((value): value is string => typeof value === "string" && Boolean(value)),
  );
  const sourceProjectCounts = new Map<string, number>();
  let publicOrPublishedCloudWorks = 0;
  for (const work of inspectedCloudWorks) {
    if (work.is_public === true || work.status === "published") {
      publicOrPublishedCloudWorks += 1;
    }
    if (typeof work.source_project_id === "string" && work.source_project_id) {
      sourceProjectCounts.set(
        work.source_project_id,
        (sourceProjectCounts.get(work.source_project_id) ?? 0) + 1,
      );
    }
  }
  const duplicateCloudProjectMappings = [...sourceProjectCounts.values()].filter(
    (count) => count > 1,
  ).length;
  const activeCloudProducts = inspectedActiveProducts.filter(
    (product) =>
      typeof product.work_id === "string" && cloudWorkIds.has(product.work_id),
  ).length;
  const dependenciesReady = Object.values(dependencies).every(Boolean);
  const dataReady =
    inventoryComplete &&
    publicOrPublishedCloudWorks === 0 &&
    activeCloudProducts === 0 &&
    duplicateCloudProjectMappings === 0;
  const migrationReady =
    dependenciesReady && artifactState === "not-applied" && dataReady;

  return {
    passed: migrationReady,
    migration: marketplacePublicationMigration,
    state: artifactState,
    checks: [
      check(
        "dependencies",
        "Migration dependency schema",
        dependenciesReady,
        "one or more required relations or columns are unavailable",
      ),
      check(
        "pre-apply-state",
        "Clean pre-apply schema state",
        artifactState === "not-applied",
        artifactState === "already-applied"
          ? "migration artifacts already exist; do not apply again"
          : "migration artifacts are partially present; stop and inspect",
      ),
      check(
        "inventory-complete",
        "Bounded Production inventory",
        inventoryComplete,
        `more than ${maximumMarketplacePublicationMigrationInventoryRows} Cloud works or active products require a paginated audit`,
      ),
      check(
        "unpublished-cloud-works",
        "No pre-existing published Cloud works without a fixed publication",
        publicOrPublishedCloudWorks === 0,
        "published or public Cloud-linked works require remediation before migration",
      ),
      check(
        "inactive-cloud-products",
        "No active product linked to a pre-migration Cloud work",
        activeCloudProducts === 0,
        "active Cloud-linked products require remediation before migration",
      ),
      check(
        "unique-project-work",
        "One work per Cloud project",
        duplicateCloudProjectMappings === 0,
        "duplicate work mappings for a Cloud project require remediation",
      ),
    ],
    counts: {
      activeCloudProducts,
      checkedActiveProducts: Math.min(
        activeProducts.length,
        maximumMarketplacePublicationMigrationInventoryRows,
      ),
      checkedCloudWorks: Math.min(
        cloudWorks.length,
        maximumMarketplacePublicationMigrationInventoryRows,
      ),
      duplicateCloudProjectMappings,
      publicOrPublishedCloudWorks,
    },
    safety: {
      identifiersPrinted: false,
      personalDataSelected: false,
      productionMutation: false,
      requestMethods: ["GET"],
      stripeRequest: false,
    },
  };
}
