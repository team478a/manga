import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const placeholderPattern =
  /(^|[^a-z])(your[-_]|replace[-_]?with|change[-_]?me|example|xxx|todo)([^a-z]|$)/i;

const configured = (value, minimumLength = 1) => {
  const normalized = value?.trim() ?? "";
  return (
    normalized.length >= minimumLength && !placeholderPattern.test(normalized)
  );
};

const decodeEnvValue = (raw) => {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'"))
    return value.slice(1, -1);
  return value;
};

export const parseEnvironmentFile = (content) => {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/,
    );
    if (!match) continue;
    result[match[1]] = decodeEnvValue(match[2]);
  }
  return result;
};

const projectRefFromSupabaseUrl = (value) => {
  try {
    const host = new URL(value?.trim() ?? "").hostname.toLowerCase();
    const match = host.match(/^([a-z0-9-]{8,64})\.supabase\.co$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

export const assessMarketplaceStagingDeployment = ({
  previewEnvironment,
  productionEnvironment,
}) => {
  const previewRef = projectRefFromSupabaseUrl(
    previewEnvironment.NEXT_PUBLIC_SUPABASE_URL,
  );
  const productionRef = projectRefFromSupabaseUrl(
    productionEnvironment.NEXT_PUBLIC_SUPABASE_URL,
  );
  const declaredStagingRef = previewEnvironment.MANGAI_STAGING_PROJECT_REF
    ?.trim()
    .toLowerCase();
  const declaredParentRef =
    previewEnvironment.MANGAI_STAGING_PARENT_PROJECT_REF
      ?.trim()
      .toLowerCase();
  const validRef = /^[a-z0-9-]{8,64}$/;
  const hasDistinctSupabaseCredentials = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].every(
    (name) =>
      configured(previewEnvironment[name]) &&
      configured(productionEnvironment[name]) &&
      previewEnvironment[name] !== productionEnvironment[name],
  );
  const isolatedSupabase = Boolean(
    previewRef &&
      productionRef &&
      declaredStagingRef &&
      declaredParentRef &&
      validRef.test(declaredStagingRef) &&
      validRef.test(declaredParentRef) &&
      previewRef === declaredStagingRef &&
      productionRef === declaredParentRef &&
      previewRef !== productionRef &&
      hasDistinctSupabaseCredentials,
  );
  const checkoutModeReady =
    previewEnvironment.MANGAI_MARKETPLACE_CHECKOUT_MODE?.trim() === "test" &&
    productionEnvironment.MANGAI_MARKETPLACE_CHECKOUT_MODE?.trim() !== "test";
  const stripeTestReady =
    configured(previewEnvironment.STRIPE_SECRET_KEY, 20) &&
    previewEnvironment.STRIPE_SECRET_KEY.trim().startsWith("sk_test_") &&
    configured(previewEnvironment.STRIPE_WEBHOOK_SECRET, 16) &&
    previewEnvironment.STRIPE_WEBHOOK_SECRET.trim().startsWith("whsec_") &&
    configured(
      previewEnvironment.CHECKOUT_CANCEL_SECRET ||
        previewEnvironment.STRIPE_WEBHOOK_SECRET,
      16,
    );

  const checks = [
    {
      id: "supabase-isolation",
      label: "Preview Supabase isolation",
      ready: isolatedSupabase,
      missing: isolatedSupabase
        ? []
        : [
            "Preview uses distinct Supabase URL, anon key, and service-role key",
            "declared staging and parent refs match their deployment targets",
          ],
    },
    {
      id: "checkout-mode",
      label: "Marketplace checkout mode",
      ready: checkoutModeReady,
      missing: checkoutModeReady
        ? []
        : ["Preview=test and Production is not test"],
    },
    {
      id: "stripe-test",
      label: "Stripe test credentials",
      ready: stripeTestReady,
      missing: stripeTestReady
        ? []
        : ["Preview test Secret Key, Webhook Secret, and Cancel Secret"],
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

const pullVercelEnvironment = (target, outputPath) => {
  const command = process.platform === "win32" ? "vercel.cmd" : "vercel";
  return spawnSync(
    command,
    ["env", "pull", outputPath, "--environment", target, "--yes"],
    {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: "pipe",
      windowsHide: true,
    },
  );
};

const printReport = (report) => {
  console.log("MANGAI Marketplace isolated staging preflight");
  console.log("==============================================");
  console.log("Environment and secret values: hidden");
  for (const check of report.checks) {
    console.log(`${check.ready ? "[READY]" : "[PENDING]"} ${check.label}`);
    for (const item of check.missing) console.log(`  [missing] ${item}`);
  }
  console.log("\nNo Production mutation, Stripe request, or payment was performed.");
};

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  const strict = process.argv.includes("--strict");
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-marketplace-preflight-"),
  );
  const previewPath = path.join(temporaryRoot, "preview.env");
  const productionPath = path.join(temporaryRoot, "production.env");
  let report;
  try {
    const previewPull = pullVercelEnvironment("preview", previewPath);
    const productionPull = pullVercelEnvironment("production", productionPath);
    if (
      previewPull.status !== 0 ||
      productionPull.status !== 0 ||
      !fs.existsSync(previewPath) ||
      !fs.existsSync(productionPath)
    ) {
      console.error(
        "Unable to read the linked Vercel Preview and Production environments.",
      );
      process.exitCode = 1;
    } else {
      report = assessMarketplaceStagingDeployment({
        previewEnvironment: parseEnvironmentFile(
          fs.readFileSync(previewPath, "utf8"),
        ),
        productionEnvironment: parseEnvironmentFile(
          fs.readFileSync(productionPath, "utf8"),
        ),
      });
      printReport(report);
      if (strict && !report.passed) process.exitCode = 1;
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
