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

const isPathInside = (parentPath, candidatePath) => {
  const relative = path.relative(parentPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
};

export const resolveCandidateEnvironmentPath = ({
  argument,
  repositoryRoot = root,
  workingDirectory = process.cwd(),
  existsSync = fs.existsSync,
  realpathSync = fs.realpathSync,
}) => {
  if (!argument || !path.isAbsolute(argument)) {
    throw new Error("Candidate environment file must use an absolute path.");
  }

  const resolvedRepositoryRoot = realpathSync(repositoryRoot);
  const resolvedCandidate = path.resolve(workingDirectory, argument);
  if (!existsSync(resolvedCandidate)) {
    throw new Error("Candidate environment file was not found.");
  }

  const realCandidate = realpathSync(resolvedCandidate);
  if (
    isPathInside(resolvedRepositoryRoot, resolvedCandidate) ||
    isPathInside(resolvedRepositoryRoot, realCandidate)
  ) {
    throw new Error(
      "Candidate environment file must be stored outside the repository.",
    );
  }
  return realCandidate;
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

const hasTargetScopedVariable = ({ metadata, key, target, type }) =>
  metadata.some(
    (entry) =>
      entry?.key === key &&
      Array.isArray(entry.target) &&
      entry.target.length === 1 &&
      entry.target[0] === target &&
      !entry.gitBranch &&
      (!type || entry.type === type),
  );

const hasTargetScopedVariables = ({ metadata, keys, target }) =>
  keys.every((key) => hasTargetScopedVariable({ metadata, key, target }));

const missingTargetSettings = ({
  environment,
  keys,
  metadata,
  target,
  type,
}) =>
  keys.filter(
    (key) =>
      !configured(environment[key]) &&
      !hasTargetScopedVariable({ metadata, key, target, type }),
  );

export const assessMarketplaceStagingDeployment = ({
  previewEnvironment,
  productionEnvironment,
  previewMetadata = [],
  productionMetadata = [],
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
  const supabaseCredentialNames = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const previewSupabaseConfigured = supabaseCredentialNames.every((name) =>
    configured(previewEnvironment[name]) ||
    hasTargetScopedVariable({
      metadata: previewMetadata,
      key: name,
      target: "preview",
    }),
  );
  const productionSupabaseValuesAvailable = supabaseCredentialNames.every(
    (name) => configured(productionEnvironment[name]),
  );
  const noKnownSupabaseCredentialCollision = supabaseCredentialNames.every(
    (name) =>
      !configured(productionEnvironment[name]) ||
      previewEnvironment[name] !== productionEnvironment[name],
  );
  const hasDistinctSupabaseValues =
    productionSupabaseValuesAvailable &&
    supabaseCredentialNames.every(
      (name) => previewEnvironment[name] !== productionEnvironment[name],
    );
  const hasIsolatedSupabaseMetadata =
    hasTargetScopedVariables({
      metadata: previewMetadata,
      keys: supabaseCredentialNames,
      target: "preview",
    }) &&
    hasTargetScopedVariables({
      metadata: productionMetadata,
      keys: supabaseCredentialNames,
      target: "production",
    });
  const productionUrlValueAvailable = configured(
    productionEnvironment.NEXT_PUBLIC_SUPABASE_URL,
  );
  const parentIdentityVerified = productionUrlValueAvailable
    ? productionRef === declaredParentRef
    : hasIsolatedSupabaseMetadata;
  const supabaseCredentialsVerified = productionSupabaseValuesAvailable
    ? hasDistinctSupabaseValues
    : hasIsolatedSupabaseMetadata && noKnownSupabaseCredentialCollision;
  const isolatedSupabase = Boolean(
    previewRef &&
      declaredStagingRef &&
      declaredParentRef &&
      validRef.test(declaredStagingRef) &&
      validRef.test(declaredParentRef) &&
      previewRef === declaredStagingRef &&
      parentIdentityVerified &&
      previewRef !== declaredParentRef &&
      previewSupabaseConfigured &&
      supabaseCredentialsVerified,
  );
  const checkoutModeReady =
    previewEnvironment.MANGAI_MARKETPLACE_CHECKOUT_MODE?.trim() === "test" &&
    productionEnvironment.MANGAI_MARKETPLACE_CHECKOUT_MODE?.trim() !== "test";
  const sensitivePreviewSettingVerified = (key, value, validator) =>
    configured(value)
      ? validator(value.trim())
      : hasTargetScopedVariable({
          metadata: previewMetadata,
          key,
          target: "preview",
          type: "sensitive",
        });
  const stripeSecretVerified = sensitivePreviewSettingVerified(
    "STRIPE_SECRET_KEY",
    previewEnvironment.STRIPE_SECRET_KEY,
    (value) => value.length >= 20 && value.startsWith("sk_test_"),
  );
  const webhookSecretVerified = sensitivePreviewSettingVerified(
    "STRIPE_WEBHOOK_SECRET",
    previewEnvironment.STRIPE_WEBHOOK_SECRET,
    (value) => value.length >= 16 && value.startsWith("whsec_"),
  );
  const cancelSecretVerified = sensitivePreviewSettingVerified(
    "CHECKOUT_CANCEL_SECRET",
    previewEnvironment.CHECKOUT_CANCEL_SECRET,
    (value) => value.length >= 16,
  );
  const stripeTestReady =
    stripeSecretVerified &&
    webhookSecretVerified &&
    cancelSecretVerified;

  const missingPreviewSupabaseSettings = missingTargetSettings({
    environment: previewEnvironment,
    keys: supabaseCredentialNames,
    metadata: previewMetadata,
    target: "preview",
  });
  const missingProductionSupabaseSettings = missingTargetSettings({
    environment: productionEnvironment,
    keys: supabaseCredentialNames,
    metadata: productionMetadata,
    target: "production",
  });
  const missingSupabaseSettings = [
    ...missingPreviewSupabaseSettings.map((key) => `Preview:${key}`),
    ...missingProductionSupabaseSettings.map((key) => `Production:${key}`),
    ...[
      "MANGAI_STAGING_PROJECT_REF",
      "MANGAI_STAGING_PARENT_PROJECT_REF",
    ]
      .filter((key) => !configured(previewEnvironment[key]))
      .map((key) => `Preview:${key}`),
  ];
  const missingCheckoutSettings = configured(
    previewEnvironment.MANGAI_MARKETPLACE_CHECKOUT_MODE,
  )
    ? []
    : ["Preview:MANGAI_MARKETPLACE_CHECKOUT_MODE"];
  const missingStripeSettings = [
    ...(!stripeSecretVerified
      ? ["Preview:STRIPE_SECRET_KEY"]
      : []),
    ...(!webhookSecretVerified
      ? ["Preview:STRIPE_WEBHOOK_SECRET"]
      : []),
    ...(!cancelSecretVerified
      ? ["Preview:CHECKOUT_CANCEL_SECRET"]
      : []),
  ];

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
      missingSettings: isolatedSupabase ? [] : missingSupabaseSettings,
    },
    {
      id: "checkout-mode",
      label: "Marketplace checkout mode",
      ready: checkoutModeReady,
      missing: checkoutModeReady
        ? []
        : ["Preview=test and Production is not test"],
      missingSettings: checkoutModeReady ? [] : missingCheckoutSettings,
    },
    {
      id: "stripe-test",
      label: "Stripe test credentials",
      ready: stripeTestReady,
      missing: stripeTestReady
        ? []
        : ["Preview test Secret Key, Webhook Secret, and Cancel Secret"],
      missingSettings: stripeTestReady ? [] : missingStripeSettings,
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

const listVercelEnvironmentMetadata = (target) => {
  const command = process.platform === "win32" ? "vercel.cmd" : "vercel";
  const result = spawnSync(
    command,
    ["env", "ls", target, "--format", "json", "--no-color"],
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
  console.log("MANGAI Marketplace isolated staging preflight");
  console.log("==============================================");
  console.log("Environment and secret values: hidden");
  for (const check of report.checks) {
    console.log(`${check.ready ? "[READY]" : "[PENDING]"} ${check.label}`);
    for (const setting of check.missingSettings)
      console.log(`  [missing-setting] ${setting}`);
    for (const item of check.missing) console.log(`  [missing] ${item}`);
  }
  console.log("\nNo Production mutation, Stripe request, or payment was performed.");
};

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  const strict = process.argv.includes("--strict");
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
    path.join(os.tmpdir(), "mangai-marketplace-preflight-"),
  );
  const previewPath = path.join(temporaryRoot, "preview.env");
  const productionPath = path.join(temporaryRoot, "production.env");
  let report;
  try {
    const previewPull = candidatePath
      ? { status: 0 }
      : pullVercelEnvironment("preview", previewPath);
    const productionPull = pullVercelEnvironment(
      "production",
      productionPath,
    );
    const previewMetadata = listVercelEnvironmentMetadata("preview");
    const productionMetadata = listVercelEnvironmentMetadata("production");
    if (
      previewPull.status !== 0 ||
      productionPull.status !== 0 ||
      previewMetadata.status !== 0 ||
      productionMetadata.status !== 0 ||
      (!candidatePath && !fs.existsSync(previewPath)) ||
      !fs.existsSync(productionPath)
    ) {
      console.error(
        candidatePath
          ? "Unable to read the linked Vercel Production environment."
          : "Unable to read the linked Vercel Preview and Production environments.",
      );
      process.exitCode = 1;
    } else {
      report = assessMarketplaceStagingDeployment({
        previewEnvironment: parseEnvironmentFile(
          fs.readFileSync(candidatePath || previewPath, "utf8"),
        ),
        productionEnvironment: parseEnvironmentFile(
          fs.readFileSync(productionPath, "utf8"),
        ),
        previewMetadata: previewMetadata.entries,
        productionMetadata: productionMetadata.entries,
      });
      printReport(report);
      if (strict && !report.passed) process.exitCode = 1;
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
