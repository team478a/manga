import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assessMarketplaceProductionCanaryPlan,
  resolveCanaryPlanPath,
} from "./check-marketplace-production-canary-plan.mjs";
import { assessMarketplaceRuntimeCanary } from "./marketplace-production-canary-runtime.mjs";

const expectedOrigin = "https://app.mang-ai.com";
const placeholderPattern =
  /(example|placeholder|redacted|replace|change[-_]?me|x{4,})/i;

const required = (environment, name) => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing Production environment: ${name}`);
  return value;
};

const checkedOrigin = (value, label) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} must be an HTTPS origin without credentials.`);
  }
  return url;
};

export function resolveMarketplaceProductionTargetEnvironment(environment) {
  const supabaseUrl = checkedOrigin(
    required(environment, "NEXT_PUBLIC_SUPABASE_URL"),
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  if (!/^[a-z0-9-]{8,64}\.supabase\.co$/i.test(supabaseUrl.hostname))
    throw new Error("Supabase URL must target a hosted Production project.");
  const siteUrl = checkedOrigin(
    required(environment, "NEXT_PUBLIC_SITE_URL"),
    "NEXT_PUBLIC_SITE_URL",
  );
  if (siteUrl.origin.toLowerCase() !== expectedOrigin)
    throw new Error("NEXT_PUBLIC_SITE_URL must target the canonical Production origin.");
  const serviceRoleKey = required(environment, "SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey.length < 20 || placeholderPattern.test(serviceRoleKey))
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  if (
    environment.MANGAI_STAGING_PROJECT_REF?.trim() ||
    environment.MANGAI_STAGING_PARENT_PROJECT_REF?.trim()
  ) {
    throw new Error("Staging project markers are not allowed in Production.");
  }
  const checkoutMode =
    environment.MANGAI_MARKETPLACE_CHECKOUT_MODE?.trim() || "disabled";
  if (!new Set(["disabled", "live"]).has(checkoutMode))
    throw new Error("Production target preflight rejects test checkout mode.");

  return { checkoutMode, serviceRoleKey, supabaseUrl };
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
  let rows;
  try {
    rows = await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
  if (!Array.isArray(rows)) throw new Error(`${label} returned an invalid shape.`);
  return rows;
};

const readinessCheck = (id, label, ready, missing) => ({
  id,
  label,
  ready,
  missing: ready ? [] : [missing],
});

export async function runMarketplaceProductionCanaryTargetPreflight({
  environment,
  fetchFn = fetch,
  now = Date.now(),
  plan,
}) {
  const planReport = assessMarketplaceProductionCanaryPlan(plan, { now });
  if (!planReport.passed)
    throw new Error("Canary plan must pass local validation before Production access.");
  const { checkoutMode, serviceRoleKey, supabaseUrl } =
    resolveMarketplaceProductionTargetEnvironment(environment);
  const runtimeCanary = assessMarketplaceRuntimeCanary(environment, now);
  const runtimeTargetReady = Boolean(
    checkoutMode === "disabled" ||
      (runtimeCanary.enabled &&
        runtimeCanary.target?.productId === plan.productId &&
        runtimeCanary.target.sellerProfileId === plan.sellerProfileId &&
        runtimeCanary.target.buyerProfileId === plan.buyerProfileId &&
        runtimeCanary.target.expiresAt === Date.parse(plan.expiresAt) &&
        runtimeCanary.target.planFingerprint === planReport.fingerprint),
  );

  const productUrl = new URL("/rest/v1/digital_products", supabaseUrl);
  productUrl.searchParams.set(
    "select",
    "id,creator_id,price,status,file_url,works:work_id(id,creator_id,status,is_public,content_class,source_project_id,current_publication_id)",
  );
  productUrl.searchParams.set("id", `eq.${plan.productId}`);
  productUrl.searchParams.set("limit", "2");

  const profilesUrl = new URL("/rest/v1/profiles", supabaseUrl);
  profilesUrl.searchParams.set("select", "id,role");
  profilesUrl.searchParams.set(
    "id",
    `in.(${plan.sellerProfileId},${plan.buyerProfileId})`,
  );
  profilesUrl.searchParams.set("limit", "3");

  const ordersUrl = new URL("/rest/v1/orders", supabaseUrl);
  ordersUrl.searchParams.set("select", "id,status");
  ordersUrl.searchParams.set("product_id", `eq.${plan.productId}`);
  ordersUrl.searchParams.set("creator_id", `eq.${plan.sellerProfileId}`);
  ordersUrl.searchParams.set("buyer_profile_id", `eq.${plan.buyerProfileId}`);
  ordersUrl.searchParams.set("payment_mode", "eq.live");
  ordersUrl.searchParams.set("status", "in.(pending,paid)");
  ordersUrl.searchParams.set("limit", "2");

  const [products, profiles, existingOrders] = await Promise.all([
    readRows({
      fetchFn,
      label: "Production product lookup",
      serviceRoleKey,
      url: productUrl,
    }),
    readRows({
      fetchFn,
      label: "Production participant lookup",
      serviceRoleKey,
      url: profilesUrl,
    }),
    readRows({
      fetchFn,
      label: "Production order lookup",
      serviceRoleKey,
      url: ordersUrl,
    }),
  ]);

  const product = products.length === 1 ? products[0] : null;
  const work =
    product?.works && !Array.isArray(product.works) ? product.works : null;
  const productReady = Boolean(
    product &&
      product.id === plan.productId &&
      product.creator_id === plan.sellerProfileId &&
      product.status === "active" &&
      Number(product.price) === plan.expectedAmountJpy &&
      typeof product.file_url === "string" &&
      product.file_url.trim(),
  );
  const workReady = Boolean(
    work &&
      work.creator_id === plan.sellerProfileId &&
      work.status === "published" &&
      work.is_public === true &&
      work.content_class === "general" &&
      (!work.source_project_id || work.current_publication_id),
  );
  const profileIds = new Set(profiles.map((profile) => profile?.id));
  const seller = profiles.find(
    (profile) => profile?.id === plan.sellerProfileId,
  );
  const participantsReady = Boolean(
    profiles.length === 2 &&
      profileIds.has(plan.sellerProfileId) &&
      profileIds.has(plan.buyerProfileId) &&
      ["creator", "admin"].includes(seller?.role),
  );
  const noExistingOrder = existingOrders.length === 0;
  const checks = [
    readinessCheck(
      "runtime-canary",
      "Runtime canary target",
      runtimeTargetReady,
      "disabled checkout or a live runtime gate matching the approved plan exactly",
    ),
    readinessCheck(
      "product",
      "Exact active product",
      productReady,
      "one active product owned by the planned seller with the exact JPY price and file",
    ),
    readinessCheck(
      "work",
      "Public general-audience work",
      workReady,
      "a published public general-audience work with a fixed Cloud publication when applicable",
    ),
    readinessCheck(
      "participants",
      "Existing isolated participants",
      participantsReady,
      "existing buyer and creator/admin seller profiles matching the plan",
    ),
    readinessCheck(
      "no-existing-order",
      "No existing live canary order",
      noExistingOrder,
      "no pending or paid live order for this product, seller, and buyer",
    ),
  ];

  return {
    passed: checks.every((item) => item.ready),
    fingerprint: planReport.fingerprint,
    safety: {
      requestMethods: ["GET"],
      personalDataSelected: false,
      productFileDownloaded: false,
      productionMutation: false,
      stripeRequest: false,
      paymentCreated: false,
    },
    checks,
  };
}

const printReport = (report) => {
  console.log("MANGAI Marketplace Production canary target preflight");
  console.log("=====================================================");
  console.log("Target identifiers, personal data, and secrets: hidden");
  for (const item of report.checks) {
    console.log(`${item.ready ? "[READY]" : "[PENDING]"} ${item.label}`);
    for (const missing of item.missing) console.log(`  [missing] ${missing}`);
  }
  console.log(`\nApproval fingerprint (SHA-256): ${report.fingerprint}`);
  console.log(
    "\nGET requests only. No Production mutation, Stripe request, file download, or payment was performed.",
  );
};

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  try {
    const planPath = resolveCanaryPlanPath({ argument: process.argv[2] });
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    const report = await runMarketplaceProductionCanaryTargetPreflight({
      environment: process.env,
      plan,
    });
    printReport(report);
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Unable to validate Production canary target.",
    );
    process.exitCode = 1;
  }
}
