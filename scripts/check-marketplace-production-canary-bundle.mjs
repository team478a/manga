import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assessMarketplaceProductionCanaryPlan,
  resolveCanaryPlanPath,
} from "./check-marketplace-production-canary-plan.mjs";
import { assessMarketplaceProductionReadiness } from "./check-marketplace-production-readiness.mjs";
import {
  parseEnvironmentFile,
  resolveCandidateEnvironmentPath,
} from "./check-marketplace-staging-deployment.mjs";
import { assessMarketplaceRuntimeCanary } from "./marketplace-production-canary-runtime.mjs";

const check = (id, label, ready, missing) => ({
  id,
  label,
  ready,
  missing: ready ? [] : [missing],
});

export function assessMarketplaceProductionCanaryBundle({
  environment,
  now = Date.now(),
  plan,
}) {
  const planReport = assessMarketplaceProductionCanaryPlan(plan, { now });
  const readinessReport = assessMarketplaceProductionReadiness({
    environment,
    now,
  });
  const runtimeCanary = assessMarketplaceRuntimeCanary(environment, now);
  const targetMatches = Boolean(
    planReport.passed &&
      runtimeCanary.enabled &&
      runtimeCanary.target?.productId === plan.productId &&
      runtimeCanary.target.sellerProfileId === plan.sellerProfileId &&
      runtimeCanary.target.buyerProfileId === plan.buyerProfileId &&
      runtimeCanary.target.expiresAt === Date.parse(plan.expiresAt) &&
      runtimeCanary.target.planFingerprint === planReport.fingerprint,
  );
  const checks = [
    check(
      "approved-plan",
      "Approved canary plan",
      planReport.passed,
      "a valid one-product, one-purchase Production canary plan",
    ),
    ...readinessReport.checks.map((item) => ({
      ...item,
      id: `candidate-${item.id}`,
      label: `Candidate ${item.label}`,
    })),
    check(
      "exact-plan-match",
      "Exact plan and candidate match",
      targetMatches,
      "candidate product, seller, buyer, expiry, and fingerprint matching the approved plan",
    ),
  ];

  return {
    passed: checks.every((item) => item.ready),
    fingerprint: planReport.fingerprint,
    safety: {
      candidateValuesPrinted: false,
      planValuesPrinted: false,
      productionConnection: false,
      productionMutation: false,
      stripeRequest: false,
      paymentCreated: false,
    },
    checks,
  };
}

const printReport = (report) => {
  console.log("MANGAI Marketplace Production canary bundle preflight");
  console.log("=====================================================");
  console.log("Plan identifiers, environment values, and secrets: hidden");
  for (const item of report.checks) {
    console.log(`${item.ready ? "[READY]" : "[PENDING]"} ${item.label}`);
    for (const missing of item.missing) console.log(`  [missing] ${missing}`);
  }
  if (report.fingerprint) {
    console.log(`\nApproval fingerprint (SHA-256): ${report.fingerprint}`);
  }
  console.log(
    "\nOffline validation only. No Production connection, mutation, Stripe request, environment update, or payment was performed.",
  );
};

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  try {
    const planPath = resolveCanaryPlanPath({ argument: process.argv[2] });
    const candidatePath = resolveCandidateEnvironmentPath({
      argument: process.argv[3],
    });
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    const environment = parseEnvironmentFile(
      fs.readFileSync(candidatePath, "utf8"),
    );
    const report = assessMarketplaceProductionCanaryBundle({
      environment,
      plan,
    });
    printReport(report);
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Unable to validate Production canary bundle.",
    );
    process.exitCode = 1;
  }
}
