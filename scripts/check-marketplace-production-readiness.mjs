import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessMarketplaceRuntimeCanary } from "./marketplace-production-canary-runtime.mjs";
import {
  parseEnvironmentFile,
  resolveCandidateEnvironmentPath,
} from "./check-marketplace-staging-deployment.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedProductionOrigin = "https://app.mang-ai.com";
const placeholderPattern =
  /(^|[^a-z])(your[-_]|replace[-_]?with|change[-_]?me|example|xxx|todo)([^a-z]|$)/i;

const configured = (value, minimumLength = 1) => {
  const normalized = value?.trim() ?? "";
  return (
    normalized.length >= minimumLength && !placeholderPattern.test(normalized)
  );
};

const projectRefFromSupabaseUrl = (value) => {
  try {
    const url = new URL(value?.trim() ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return (
      url.hostname
        .toLowerCase()
        .match(/^([a-z0-9-]{8,64})\.supabase\.co$/)?.[1] ?? null
    );
  } catch {
    return null;
  }
};

const normalizedOrigin = (value) => {
  try {
    const url = new URL(value?.trim() ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
};

const hasProductionOnlyVariable = ({ metadata, key, type }) =>
  metadata.some(
    (entry) =>
      entry?.key === key &&
      Array.isArray(entry.target) &&
      entry.target.length === 1 &&
      entry.target[0] === "production" &&
      !entry.gitBranch &&
      (!type || entry.type === type),
  );

export const assessMarketplaceProductionReadiness = ({
  environment,
  metadata = [],
  now = Date.now(),
  requireTargetScopedMetadata = false,
  expectedOrigin = expectedProductionOrigin,
}) => {
  const productionRef = projectRefFromSupabaseUrl(
    environment.NEXT_PUBLIC_SUPABASE_URL,
  );
  const supabaseKeys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const deploymentKeys = [
    ...supabaseKeys,
    "NEXT_PUBLIC_SITE_URL",
    "MANGAI_MARKETPLACE_CHECKOUT_MODE",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CHECKOUT_CANCEL_SECRET",
    "MANGAI_MARKETPLACE_LIVE_ACCESS",
    "MANGAI_MARKETPLACE_CANARY_PRODUCT_ID",
    "MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID",
    "MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID",
    "MANGAI_MARKETPLACE_CANARY_EXPIRES_AT",
    "MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT",
  ];
  const sensitiveKeys = new Set([
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CHECKOUT_CANCEL_SECRET",
    "MANGAI_MARKETPLACE_CANARY_PRODUCT_ID",
    "MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID",
    "MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID",
    "MANGAI_MARKETPLACE_CANARY_EXPIRES_AT",
    "MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT",
  ]);
  const targetScopeReady =
    !requireTargetScopedMetadata ||
    deploymentKeys.every((key) =>
      hasProductionOnlyVariable({
        metadata,
        key,
        type: sensitiveKeys.has(key) ? "sensitive" : undefined,
      }),
    );
  const supabaseReady = Boolean(
    productionRef &&
      supabaseKeys.every((key) => configured(environment[key], 8)) &&
      environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() !==
        environment.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      !configured(environment.MANGAI_STAGING_PROJECT_REF) &&
      !configured(environment.MANGAI_STAGING_PARENT_PROJECT_REF),
  );
  const normalizedExpectedOrigin = normalizedOrigin(expectedOrigin);
  const siteOriginReady = Boolean(
    normalizedExpectedOrigin &&
      normalizedOrigin(environment.NEXT_PUBLIC_SITE_URL) ===
        normalizedExpectedOrigin,
  );
  const checkoutModeReady =
    environment.MANGAI_MARKETPLACE_CHECKOUT_MODE?.trim() === "live";
  const canaryReady = assessMarketplaceRuntimeCanary(environment, now).enabled;
  const stripeLiveReady = Boolean(
    configured(environment.STRIPE_SECRET_KEY, 20) &&
      environment.STRIPE_SECRET_KEY.trim().startsWith("sk_live_") &&
      configured(environment.STRIPE_WEBHOOK_SECRET, 16) &&
      environment.STRIPE_WEBHOOK_SECRET.trim().startsWith("whsec_") &&
      configured(environment.CHECKOUT_CANCEL_SECRET, 16),
  );

  const checks = [
    {
      id: "production-scope",
      label: "Production-only Vercel scope",
      ready: targetScopeReady,
      missing: targetScopeReady
        ? []
        : ["Marketplace credentials are scoped only to Production"],
    },
    {
      id: "production-supabase",
      label: "Production Supabase identity",
      ready: supabaseReady,
      missing: supabaseReady
        ? []
        : [
            "Production Supabase URL, anon key, and service-role key",
            "no Staging project markers in Production",
          ],
    },
    {
      id: "production-origin",
      label: "Production checkout origin",
      ready: siteOriginReady,
      missing: siteOriginReady
        ? []
        : [`NEXT_PUBLIC_SITE_URL=${expectedProductionOrigin}`],
    },
    {
      id: "checkout-live",
      label: "Marketplace live checkout mode",
      ready: checkoutModeReady,
      missing: checkoutModeReady
        ? []
        : ["MANGAI_MARKETPLACE_CHECKOUT_MODE=live"],
    },
    {
      id: "checkout-canary",
      label: "Single-target live canary gate",
      ready: canaryReady,
      missing: canaryReady
        ? []
        : ["one product, seller, buyer, fingerprint, and expiry within 24 hours"],
    },
    {
      id: "stripe-live",
      label: "Stripe live credentials",
      ready: stripeLiveReady,
      missing: stripeLiveReady
        ? []
        : ["live Secret Key, Webhook Secret, and independent Cancel Secret"],
    },
  ];

  return {
    passed: checks.every((check) => check.ready),
    safety: {
      environmentValuesPrinted: false,
      productionMutation: false,
      stripeRequest: false,
      paymentCreated: false,
    },
    checks,
  };
};

const pullVercelEnvironment = (outputPath) => {
  const command = process.platform === "win32" ? "vercel.cmd" : "vercel";
  return spawnSync(
    command,
    ["env", "pull", outputPath, "--environment", "production", "--yes"],
    {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: "pipe",
      windowsHide: true,
    },
  );
};

const listProductionMetadata = () => {
  const command = process.platform === "win32" ? "vercel.cmd" : "vercel";
  const result = spawnSync(
    command,
    ["env", "ls", "production", "--format", "json", "--no-color"],
    {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: "pipe",
      windowsHide: true,
    },
  );
  if (result.status !== 0) return { status: result.status, entries: [] };
  try {
    const parsed = JSON.parse(result.stdout);
    return {
      status: 0,
      entries: Array.isArray(parsed?.envs) ? parsed.envs : [],
    };
  } catch {
    return { status: 1, entries: [] };
  }
};

const printReport = (report) => {
  console.log("MANGAI Marketplace Production readiness preflight");
  console.log("================================================");
  console.log("Environment and secret values: hidden");
  for (const check of report.checks) {
    console.log(`${check.ready ? "[READY]" : "[PENDING]"} ${check.label}`);
    for (const item of check.missing) console.log(`  [missing] ${item}`);
  }
  console.log(
    "\nNo Production mutation, Stripe request, payment, or environment update was performed.",
  );
};

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  const strict = process.argv.includes("--strict");
  const injected = process.argv.includes("--injected");
  const candidateIndex = process.argv.indexOf("--candidate");
  let candidatePath = null;
  if (candidateIndex >= 0) {
    try {
      candidatePath = resolveCandidateEnvironmentPath({
        argument: process.argv[candidateIndex + 1],
      });
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Invalid candidate file.",
      );
      process.exitCode = 1;
    }
  }
  if (candidateIndex >= 0 && !candidatePath) process.exit();

  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-marketplace-production-preflight-"),
  );
  const productionPath = path.join(temporaryRoot, "production.env");
  try {
    const productionPull =
      injected || candidatePath
        ? { status: 0 }
        : pullVercelEnvironment(productionPath);
    const metadata = candidatePath
      ? { status: 0, entries: [] }
      : listProductionMetadata();
    if (
      productionPull.status !== 0 ||
      metadata.status !== 0 ||
      (!injected && !candidatePath && !fs.existsSync(productionPath))
    ) {
      console.error("Unable to read the linked Vercel Production environment.");
      process.exitCode = 1;
    } else {
      const environment = injected
        ? process.env
        : parseEnvironmentFile(
            fs.readFileSync(candidatePath || productionPath, "utf8"),
          );
      const report = assessMarketplaceProductionReadiness({
        environment,
        metadata: metadata.entries,
        requireTargetScopedMetadata: !candidatePath,
      });
      printReport(report);
      if (strict && !report.passed) process.exitCode = 1;
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
