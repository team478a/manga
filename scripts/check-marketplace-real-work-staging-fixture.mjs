import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parseEnvironmentFile,
  resolveCandidateEnvironmentPath,
} from "./check-marketplace-staging-deployment.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_REF_PATTERN = /^[a-z0-9-]{8,64}$/;
const PLACEHOLDER_PATTERN =
  /(example|placeholder|redacted|replace|change[-_]?me|x{4,})/i;

const required = (environment, name) => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing staging environment: ${name}`);
  return value;
};

const checkedUrl = (value, label) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error(`${label} must be an HTTPS URL without credentials.`);
  return url;
};

export function resolveMarketplaceRealWorkFixtureEnvironment(environment) {
  if (required(environment, "MANGAI_DB_ENV") !== "staging")
    throw new Error("MANGAI_DB_ENV must be staging.");
  if (required(environment, "MANGAI_MARKETPLACE_CHECKOUT_MODE") !== "test")
    throw new Error("Marketplace checkout mode must be test.");

  const stagingRef = required(environment, "MANGAI_STAGING_PROJECT_REF").toLowerCase();
  const parentRef = required(
    environment,
    "MANGAI_STAGING_PARENT_PROJECT_REF",
  ).toLowerCase();
  if (
    !PROJECT_REF_PATTERN.test(stagingRef) ||
    !PROJECT_REF_PATTERN.test(parentRef) ||
    stagingRef === parentRef
  )
    throw new Error("Staging and parent project refs must be valid and distinct.");

  const supabaseUrl = checkedUrl(
    required(environment, "NEXT_PUBLIC_SUPABASE_URL"),
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  if (supabaseUrl.hostname !== `${stagingRef}.supabase.co`)
    throw new Error("Supabase URL does not match the declared staging ref.");

  const serviceRoleKey = required(environment, "SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey.length < 20 || PLACEHOLDER_PATTERN.test(serviceRoleKey))
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");

  const identifiers = {
    buyerProfileId: required(environment, "MANGAI_STAGING_BUYER_PROFILE_ID"),
    productId: required(environment, "MANGAI_STAGING_E2E_PRODUCT_ID"),
    sellerProfileId: required(environment, "MANGAI_STAGING_SELLER_PROFILE_ID"),
    unpurchasedProfileId: required(
      environment,
      "MANGAI_STAGING_UNPURCHASED_PROFILE_ID",
    ),
    workId: required(environment, "MANGAI_STAGING_E2E_WORK_ID"),
  };
  if (Object.values(identifiers).some((value) => !UUID_PATTERN.test(value)))
    throw new Error("Staging fixture identifiers must be UUIDs.");
  if (
    new Set([
      identifiers.sellerProfileId,
      identifiers.buyerProfileId,
      identifiers.unpurchasedProfileId,
    ]).size !== 3
  )
    throw new Error("Seller, buyer, and unpurchased profiles must be distinct.");

  return {
    ...identifiers,
    parentRef,
    serviceRoleKey,
    stagingRef,
    supabaseUrl,
  };
}

const authorizedHeaders = (serviceRoleKey) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
});

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
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`${label} returned an invalid shape.`);
  return rows;
};

const readTargetRows = ({
  fetchFn,
  filters,
  label,
  limit = 2,
  select,
  serviceRoleKey,
  supabaseUrl,
  table,
}) => {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  url.searchParams.set("select", select);
  for (const [name, value] of Object.entries(filters))
    url.searchParams.set(name, value);
  url.searchParams.set("limit", String(limit));
  return readRows({ fetchFn, label, serviceRoleKey, url });
};

const exactlyOne = (rows) => (rows.length === 1 ? rows[0] : null);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

const check = (id, label, ready, missing) => ({
  id,
  label,
  ready,
  missing: ready ? [] : [missing],
});

export async function runMarketplaceRealWorkStagingFixtureAudit({
  environment,
  fetchFn = fetch,
}) {
  const target = resolveMarketplaceRealWorkFixtureEnvironment(environment);
  const request = (options) =>
    readTargetRows({
      ...options,
      fetchFn,
      serviceRoleKey: target.serviceRoleKey,
      supabaseUrl: target.supabaseUrl,
    });

  const [sellerRows, buyerRows, unpurchasedRows, workRows, productRows] =
    await Promise.all([
      request({
        table: "profiles",
        select: "id,role",
        filters: { id: `eq.${target.sellerProfileId}` },
        label: "Staging seller profile",
      }),
      request({
        table: "profiles",
        select: "id,role",
        filters: { id: `eq.${target.buyerProfileId}` },
        label: "Staging buyer profile",
      }),
      request({
        table: "profiles",
        select: "id,role",
        filters: { id: `eq.${target.unpurchasedProfileId}` },
        label: "Staging unpurchased profile",
      }),
      request({
        table: "works",
        select:
          "id,creator_id,source_project_id,content_class,status,is_public,current_publication_id",
        filters: { id: `eq.${target.workId}` },
        label: "Staging E2E work",
      }),
      request({
        table: "digital_products",
        select: "id,work_id,creator_id,price,status,file_url",
        filters: { id: `eq.${target.productId}` },
        label: "Staging E2E product",
      }),
    ]);

  const seller = exactlyOne(sellerRows);
  const buyer = exactlyOne(buyerRows);
  const unpurchased = exactlyOne(unpurchasedRows);
  const work = exactlyOne(workRows);
  const product = exactlyOne(productRows);

  const [projectRows, publicationRows, orderRows] = await Promise.all([
    work?.source_project_id
      ? request({
          table: "cloud_projects",
          select: "id,owner_profile_id,content_class,visibility,deleted_at",
          filters: { id: `eq.${work.source_project_id}` },
          label: "Staging E2E Cloud project",
        })
      : Promise.resolve([]),
    work?.current_publication_id
      ? request({
          table: "cloud_work_publications",
          select:
            "id,work_id,project_id,checkpoint_id,created_by_profile_id,page_count,pdf_storage_path,manifest_sha256",
          filters: { id: `eq.${work.current_publication_id}` },
          label: "Staging E2E publication",
        })
      : Promise.resolve([]),
    request({
      table: "orders",
      select: "id",
      filters: { product_id: `eq.${target.productId}` },
      label: "Staging E2E orders",
      limit: 1,
    }),
  ]);

  const project = exactlyOne(projectRows);
  const publication = exactlyOne(publicationRows);
  const [checkpointRows, pageRows] = await Promise.all([
    publication?.checkpoint_id
      ? request({
          table: "cloud_project_checkpoints",
          select:
            "id,project_id,created_by_profile_id,kind,page_count,manifest_sha256",
          filters: { id: `eq.${publication.checkpoint_id}` },
          label: "Staging E2E release checkpoint",
        })
      : Promise.resolve([]),
    publication?.id
      ? request({
          table: "cloud_work_publication_pages",
          select: "publication_id,page_number,width,height,storage_path,is_sample",
          filters: { publication_id: `eq.${publication.id}`, order: "page_number.asc" },
          label: "Staging E2E publication pages",
          limit: 3,
        })
      : Promise.resolve([]),
  ]);
  const checkpoint = exactlyOne(checkpointRows);

  const profilesReady =
    seller?.id === target.sellerProfileId &&
    seller.role === "creator" &&
    buyer?.id === target.buyerProfileId &&
    unpurchased?.id === target.unpurchasedProfileId;
  const workReady = Boolean(
    work &&
      work.id === target.workId &&
      work.creator_id === target.sellerProfileId &&
      work.source_project_id &&
      work.current_publication_id &&
      work.content_class === "general" &&
      work.status === "draft" &&
      work.is_public === false,
  );
  const projectReady = Boolean(
    project &&
      project.id === work?.source_project_id &&
      project.owner_profile_id === target.sellerProfileId &&
      project.content_class === "general" &&
      project.visibility === "private" &&
      project.deleted_at === null,
  );
  const publicationReady = Boolean(
    publication &&
      publication.id === work?.current_publication_id &&
      publication.work_id === target.workId &&
      publication.project_id === work?.source_project_id &&
      publication.created_by_profile_id === target.sellerProfileId &&
      publication.page_count === 2 &&
      nonempty(publication.pdf_storage_path),
  );
  const checkpointReady = Boolean(
    checkpoint &&
      checkpoint.id === publication?.checkpoint_id &&
      checkpoint.project_id === publication?.project_id &&
      checkpoint.created_by_profile_id === target.sellerProfileId &&
      checkpoint.kind === "release" &&
      checkpoint.page_count === 2 &&
      checkpoint.manifest_sha256 === publication?.manifest_sha256,
  );
  const pageNumbers = pageRows.map((page) => page.page_number);
  const samplePageCount = pageRows.filter((page) => page.is_sample === true).length;
  const pagesReady =
    pageRows.length === 2 &&
    pageNumbers[0] === 1 &&
    pageNumbers[1] === 2 &&
    pageRows.every(
      (page) =>
        page.publication_id === publication?.id &&
        Number.isInteger(page.width) &&
        page.width > 0 &&
        Number.isInteger(page.height) &&
        page.height > 0 &&
        nonempty(page.storage_path),
    ) &&
    new Set(pageRows.map((page) => page.storage_path)).size === 2 &&
    samplePageCount <= 1;
  const productReady = Boolean(
    product &&
      product.id === target.productId &&
      product.work_id === target.workId &&
      product.creator_id === target.sellerProfileId &&
      product.status === "paused" &&
      Number.isInteger(product.price) &&
      product.price >= 50 &&
      product.price <= 1000 &&
      nonempty(product.file_url) &&
      product.file_url === publication?.pdf_storage_path,
  );
  const ordersReady = orderRows.length === 0;

  const checks = [
    check(
      "account-separation",
      "Seller, buyer, and unpurchased account separation",
      profilesReady,
      "Provide three existing distinct Staging profiles; Seller must have creator role",
    ),
    check(
      "private-work",
      "Private general-audience Cloud work",
      workReady,
      "Target must be an unpublished draft with a source project and fixed publication",
    ),
    check(
      "private-project",
      "Private Cloud project ownership",
      projectReady,
      "Project must be private, general-audience, active, and owned by Seller",
    ),
    check(
      "fixed-publication",
      "Fixed two-page publication",
      publicationReady,
      "Current publication must belong to the work/project/Seller and contain two pages",
    ),
    check(
      "release-checkpoint",
      "Matching release checkpoint",
      checkpointReady,
      "Publication must reference a matching two-page release checkpoint",
    ),
    check(
      "publication-pages",
      "Ordered two-page publication manifest",
      pagesReady,
      "Pages 1 and 2 must have distinct paths and no more than one sample page",
    ),
    check(
      "paused-product",
      "Paused low-price test product",
      productReady,
      "Product must match the work/publication, be paused, and cost 50 to 1,000 yen",
    ),
    check(
      "zero-orders",
      "Zero existing target orders",
      ordersReady,
      "Use a target product with no existing orders before starting the E2E",
    ),
  ];

  return {
    passed: checks.every((item) => item.ready),
    checks,
    counts: {
      checkedProfiles: [seller, buyer, unpurchased].filter(Boolean).length,
      existingOrders: orderRows.length,
      publicationPages: pageRows.length,
      samplePages: samplePageCount,
    },
    safety: {
      requestMethods: ["GET"],
      identifiersPrinted: false,
      personalDataSelected: false,
      productFileDownloaded: false,
      stagingMutation: false,
      productionMutation: false,
      stripeRequest: false,
      paymentCreated: false,
    },
  };
}

const printReport = (report) => {
  console.log("MANGAI Marketplace Staging real-work fixture audit");
  console.log("==================================================");
  console.log("Profile, work, product, publication, and storage identifiers: hidden");
  for (const item of report.checks) {
    console.log(`${item.ready ? "[READY]" : "[PENDING]"} ${item.label}`);
    for (const missing of item.missing) console.log(`  [missing] ${missing}`);
  }
  console.log(`\nChecked profiles: ${report.counts.checkedProfiles}`);
  console.log(`Publication pages: ${report.counts.publicationPages}`);
  console.log(`Sample pages: ${report.counts.samplePages}`);
  console.log(`Existing target orders: ${report.counts.existingOrders}`);
  console.log(
    "\nGET requests only. No Staging or Production mutation, Stripe request, file download, or payment was performed.",
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
    )
      throw new Error("Use no arguments or --candidate with one environment file.");
    const candidatePath =
      argumentsList.length === 2
        ? resolveCandidateEnvironmentPath({ argument: argumentsList[1] })
        : null;
    const report = await runMarketplaceRealWorkStagingFixtureAudit({
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
        : "Unable to inspect the Staging Marketplace fixture.",
    );
    process.exitCode = 1;
  }
}
