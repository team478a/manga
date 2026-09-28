import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveMarketplaceProductionTargetEnvironment } from "./check-marketplace-production-canary-target.mjs";
import {
  parseEnvironmentFile,
  resolveCandidateEnvironmentPath,
} from "./check-marketplace-staging-deployment.mjs";

export const marketplacePublicationMigration = Object.freeze({
  checksumSha256:
    "eaf9d6af5febdad9c8e78c3de80c2181a30afac60f3572a6758d82e1e247b7aa",
  id: "202608140004_cloud_work_publications",
});

const maximumInventoryRows = 100;
const missingSchemaCodes = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

const authorizedHeaders = (serviceRoleKey) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
});

const responseErrorCode = async (response) => {
  try {
    const body = await response.json();
    return typeof body?.code === "string" ? body.code : null;
  } catch {
    return null;
  }
};

const probeSchema = async ({ fetchFn, label, serviceRoleKey, url }) => {
  let response;
  try {
    response = await fetchFn(url, {
      headers: authorizedHeaders(serviceRoleKey),
      method: "GET",
    });
  } catch {
    throw new Error(`${label} request failed.`);
  }
  if (response.ok) return true;
  const code = await responseErrorCode(response);
  if ([400, 404].includes(response.status) && missingSchemaCodes.has(code))
    return false;
  throw new Error(`${label} request failed with HTTP ${response.status}.`);
};

const readRows = async ({ fetchFn, label, serviceRoleKey, url }) => {
  let response;
  try {
    response = await fetchFn(url, {
      headers: authorizedHeaders(serviceRoleKey),
      method: "GET",
    });
  } catch {
    throw new Error(`${label} request failed.`);
  }
  if (!response.ok)
    throw new Error(`${label} request failed with HTTP ${response.status}.`);
  let rows;
  try {
    rows = await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
  if (!Array.isArray(rows)) throw new Error(`${label} returned an invalid shape.`);
  return rows;
};

const relationProbeUrl = (supabaseUrl, relation, columns) => {
  const url = new URL(`/rest/v1/${relation}`, supabaseUrl);
  url.searchParams.set("select", columns);
  url.searchParams.set("limit", "0");
  return url;
};

const check = (id, label, ready, missing) => ({
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
}) {
  const artifactValues = Object.values(artifacts);
  const artifactState = artifactValues.every(Boolean)
    ? "already-applied"
    : artifactValues.every((value) => !value)
      ? "not-applied"
      : "partial";
  const inventoryComplete =
    cloudWorks.length <= maximumInventoryRows &&
    activeProducts.length <= maximumInventoryRows;
  const inspectedCloudWorks = cloudWorks.slice(0, maximumInventoryRows);
  const inspectedActiveProducts = activeProducts.slice(0, maximumInventoryRows);
  const cloudWorkIds = new Set(
    inspectedCloudWorks
      .map((work) => work?.id)
      .filter((value) => typeof value === "string" && value),
  );
  const sourceProjectCounts = new Map();
  let publicOrPublishedCloudWorks = 0;
  for (const work of inspectedCloudWorks) {
    if (work?.is_public === true || work?.status === "published")
      publicOrPublishedCloudWorks += 1;
    if (typeof work?.source_project_id === "string" && work.source_project_id) {
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
      typeof product?.work_id === "string" && cloudWorkIds.has(product.work_id),
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
        `more than ${maximumInventoryRows} Cloud works or active products require a paginated audit`,
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
        maximumInventoryRows,
      ),
      checkedCloudWorks: Math.min(cloudWorks.length, maximumInventoryRows),
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

export async function runMarketplacePublicationMigrationReadiness({
  environment,
  fetchFn = fetch,
}) {
  const { serviceRoleKey, supabaseUrl } =
    resolveMarketplaceProductionTargetEnvironment(environment);
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
  };
  const dependencyEntries = await Promise.all(
    Object.entries(dependencyDefinitions).map(async ([key, [relation, columns]]) => [
      key,
      await probeSchema({
        fetchFn,
        label: `Production ${relation} dependency`,
        serviceRoleKey,
        url: relationProbeUrl(supabaseUrl, relation, columns),
      }),
    ]),
  );
  const artifactDefinitions = {
    workPublicationColumns: [
      "works",
      "current_publication_id,published_version,published_at",
    ],
    publicationsTable: ["cloud_work_publications", "id"],
    publicationPagesTable: ["cloud_work_publication_pages", "publication_id"],
  };
  const artifactEntries = await Promise.all(
    Object.entries(artifactDefinitions).map(async ([key, [relation, columns]]) => [
      key,
      await probeSchema({
        fetchFn,
        label: `Production ${relation} migration artifact`,
        serviceRoleKey,
        url: relationProbeUrl(supabaseUrl, relation, columns),
      }),
    ]),
  );

  const dependencies = Object.fromEntries(dependencyEntries);
  const artifacts = Object.fromEntries(artifactEntries);
  if (!dependencies.works || !dependencies.digitalProducts) {
    return assessMarketplacePublicationMigrationReadiness({
      activeProducts: [],
      artifacts,
      cloudWorks: [],
      dependencies,
    });
  }

  const cloudWorksUrl = new URL("/rest/v1/works", supabaseUrl);
  cloudWorksUrl.searchParams.set(
    "select",
    "id,source_project_id,status,is_public",
  );
  cloudWorksUrl.searchParams.set("source_project_id", "not.is.null");
  cloudWorksUrl.searchParams.set("order", "created_at.asc,id.asc");
  cloudWorksUrl.searchParams.set("limit", String(maximumInventoryRows + 1));

  const activeProductsUrl = new URL("/rest/v1/digital_products", supabaseUrl);
  activeProductsUrl.searchParams.set("select", "id,work_id,status");
  activeProductsUrl.searchParams.set("status", "eq.active");
  activeProductsUrl.searchParams.set("order", "created_at.asc,id.asc");
  activeProductsUrl.searchParams.set("limit", String(maximumInventoryRows + 1));

  const [cloudWorks, activeProducts] = await Promise.all([
    readRows({
      fetchFn,
      label: "Production Cloud work inventory",
      serviceRoleKey,
      url: cloudWorksUrl,
    }),
    readRows({
      fetchFn,
      label: "Production active product inventory",
      serviceRoleKey,
      url: activeProductsUrl,
    }),
  ]);

  return assessMarketplacePublicationMigrationReadiness({
    activeProducts,
    artifacts,
    cloudWorks,
    dependencies,
  });
}

const printReport = (report) => {
  console.log("MANGAI Marketplace publication migration readiness");
  console.log("==================================================");
  console.log(`Migration: ${report.migration.id}`);
  console.log(`SHA-256: ${report.migration.checksumSha256}`);
  console.log("Identifiers, personal data, and environment values: hidden");
  for (const item of report.checks) {
    console.log(`${item.ready ? "[READY]" : "[PENDING]"} ${item.label}`);
    for (const missing of item.missing) console.log(`  [missing] ${missing}`);
  }
  console.log(`\nSchema state: ${report.state}`);
  console.log(`Checked Cloud works: ${report.counts.checkedCloudWorks}`);
  console.log(`Checked active products: ${report.counts.checkedActiveProducts}`);
  console.log(
    `Published/public Cloud works: ${report.counts.publicOrPublishedCloudWorks}`,
  );
  console.log(`Active Cloud products: ${report.counts.activeCloudProducts}`);
  console.log(
    `Duplicate Cloud project mappings: ${report.counts.duplicateCloudProjectMappings}`,
  );
  console.log(
    "\nGET requests only. No Production mutation, migration apply, Stripe request, file download, environment update, or payment was performed.",
  );
};

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  try {
    const argumentsList = process.argv.slice(2);
    if (
      argumentsList.length !== 0 &&
      (argumentsList.length !== 2 || argumentsList[0] !== "--candidate")
    ) {
      throw new Error("Use no arguments or --candidate with one environment file.");
    }
    const candidatePath =
      argumentsList.length === 2
        ? resolveCandidateEnvironmentPath({ argument: argumentsList[1] })
        : null;
    const report = await runMarketplacePublicationMigrationReadiness({
      environment: candidatePath
        ? parseEnvironmentFile(fs.readFileSync(candidatePath, "utf8"))
        : process.env,
    });
    printReport(report);
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Unable to inspect publication migration readiness.",
    );
    process.exitCode = 1;
  }
}
