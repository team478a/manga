import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedOrigin = "https://app.mang-ai.com";
const expectedFields = [
  "schemaVersion",
  "purpose",
  "environment",
  "productionOrigin",
  "checkoutMode",
  "productId",
  "sellerProfileId",
  "buyerProfileId",
  "currency",
  "expectedAmountJpy",
  "maxPurchaseCount",
  "refundOnAcceptanceFailure",
  "createdAt",
  "expiresAt",
];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isPathInside = (parentPath, candidatePath) => {
  const relative = path.relative(parentPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
};

export const resolveCanaryPlanPath = ({
  argument,
  repositoryRoot = root,
  existsSync = fs.existsSync,
  realpathSync = fs.realpathSync,
}) => {
  if (!argument || !path.isAbsolute(argument)) {
    throw new Error("Canary plan must use an absolute path.");
  }
  if (!existsSync(argument)) throw new Error("Canary plan was not found.");

  const resolvedRepositoryRoot = realpathSync(repositoryRoot);
  const resolvedPlan = path.resolve(argument);
  const realPlan = realpathSync(resolvedPlan);
  if (
    isPathInside(resolvedRepositoryRoot, resolvedPlan) ||
    isPathInside(resolvedRepositoryRoot, realPlan)
  ) {
    throw new Error("Canary plan must be stored outside the repository.");
  }
  return realPlan;
};

const normalizeOrigin = (value) => {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
};

const parseTimestamp = (value) => {
  if (typeof value !== "string" || !value.includes("T")) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const check = (id, label, ready, missing) => ({
  id,
  label,
  ready,
  missing: ready ? [] : [missing],
});

export const assessMarketplaceProductionCanaryPlan = (
  plan,
  { now = Date.now() } = {},
) => {
  const objectReady =
    plan !== null && typeof plan === "object" && !Array.isArray(plan);
  const keys = objectReady ? Object.keys(plan) : [];
  const fieldsReady =
    objectReady &&
    keys.length === expectedFields.length &&
    expectedFields.every((field) => keys.includes(field));
  const identityReady = Boolean(
    fieldsReady &&
      uuidPattern.test(plan.productId) &&
      uuidPattern.test(plan.sellerProfileId) &&
      uuidPattern.test(plan.buyerProfileId) &&
      plan.sellerProfileId.toLowerCase() !== plan.buyerProfileId.toLowerCase(),
  );
  const targetReady = Boolean(
    fieldsReady &&
      plan.schemaVersion === 1 &&
      plan.purpose === "marketplace-production-canary" &&
      plan.environment === "production" &&
      plan.checkoutMode === "live" &&
      normalizeOrigin(plan.productionOrigin) === expectedOrigin,
  );
  const purchaseReady = Boolean(
    fieldsReady &&
      plan.currency === "jpy" &&
      Number.isInteger(plan.expectedAmountJpy) &&
      plan.expectedAmountJpy >= 50 &&
      plan.expectedAmountJpy <= 1000 &&
      plan.maxPurchaseCount === 1 &&
      plan.refundOnAcceptanceFailure === true,
  );
  const createdAt = fieldsReady ? parseTimestamp(plan.createdAt) : null;
  const expiresAt = fieldsReady ? parseTimestamp(plan.expiresAt) : null;
  const timeReady = Boolean(
    createdAt !== null &&
      expiresAt !== null &&
      createdAt <= now + 5 * 60 * 1000 &&
      expiresAt > now &&
      expiresAt > createdAt &&
      expiresAt - createdAt <= 24 * 60 * 60 * 1000,
  );
  const checks = [
    check(
      "fixed-schema",
      "Fixed canary schema",
      fieldsReady,
      "exact versioned fields with no free-form or secret fields",
    ),
    check(
      "production-target",
      "Production target",
      targetReady,
      "Production, live checkout, and canonical origin",
    ),
    check(
      "isolated-identities",
      "Single product and isolated participants",
      identityReady,
      "one UUID product and different seller/buyer UUIDs",
    ),
    check(
      "single-small-purchase",
      "Single low-value purchase",
      purchaseReady,
      "one JPY purchase between 50 and 1,000 yen with refund fallback",
    ),
    check(
      "approval-window",
      "Short approval window",
      timeReady,
      "current timestamps with an expiry no more than 24 hours later",
    ),
  ];
  const passed = checks.every((item) => item.ready);
  const normalizedPlan = passed
    ? Object.fromEntries(expectedFields.map((field) => [field, plan[field]]))
    : null;
  const fingerprint = normalizedPlan
    ? createHash("sha256")
        .update(JSON.stringify(normalizedPlan))
        .digest("hex")
    : null;

  return {
    passed,
    fingerprint,
    safety: {
      planValuesPrinted: false,
      productionConnection: false,
      productionMutation: false,
      stripeRequest: false,
      paymentCreated: false,
    },
    checks,
  };
};

const printReport = (report) => {
  console.log("MANGAI Marketplace Production canary plan preflight");
  console.log("===================================================");
  console.log("Plan identifiers and values: hidden");
  for (const item of report.checks) {
    console.log(`${item.ready ? "[READY]" : "[PENDING]"} ${item.label}`);
    for (const missing of item.missing) console.log(`  [missing] ${missing}`);
  }
  if (report.fingerprint) {
    console.log(`\nApproval fingerprint (SHA-256): ${report.fingerprint}`);
  }
  console.log(
    "\nNo Production connection, mutation, Stripe request, or payment was performed.",
  );
};

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  try {
    const planPath = resolveCanaryPlanPath({ argument: process.argv[2] });
    const parsed = JSON.parse(fs.readFileSync(planPath, "utf8"));
    const report = assessMarketplaceProductionCanaryPlan(parsed);
    printReport(report);
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Unable to validate canary plan.",
    );
    process.exitCode = 1;
  }
}
