import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readAcceptanceRecord,
  summarizeAcceptance,
} from "./lib/rc-acceptance.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const runFullValidation = args.has("--full");
const strictExternalReadiness = args.has("--strict");

const help = `MANGAI release candidate preflight

Usage:
  npm run rc:preflight          Check repository and external-service readiness
  npm run rc:validate           Run the complete local quality gate
  npm run rc:preflight:strict   Fail when required external configuration is missing

Options:
  --full    Run typecheck, lint, tests, builds, and migration validation
  --strict  Exit non-zero when an external configuration group is not ready
  --help    Show this help

Environment values are never printed.`;

if (args.has("--help") || args.has("-h")) {
  console.log(help);
  process.exit(0);
}

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};

  const result = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
    );
    if (!match) continue;

    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    )
      value = value.slice(1, -1);
    result[match[1]] = value;
  }
  return result;
};

const fileEnvironment = {
  ...parseEnvFile(path.join(root, ".env")),
  ...parseEnvFile(path.join(root, ".env.local")),
};
const environment = { ...fileEnvironment, ...process.env };

const placeholderPattern =
  /(^|[^a-z])(your[-_]|replace[-_]?with|change[-_]?me|example|xxx|todo)([^a-z]|$)/i;

const stateOf = (name, minimumLength = 1) => {
  const value = environment[name]?.trim() ?? "";
  if (!value) return "missing";
  if (value.length < minimumLength || placeholderPattern.test(value))
    return "placeholder";
  return "configured";
};

const effectiveSecretState = (primary, fallback, minimumLength) => {
  const primaryState = stateOf(primary, minimumLength);
  if (primaryState === "configured") return primaryState;
  return stateOf(fallback, minimumLength);
};

const commandAvailable = (command) => {
  const finder = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(finder, [command], {
    cwd: root,
    stdio: "ignore",
    windowsHide: true,
  });
  return result.status === 0;
};

const checks = [
  {
    name: "Hub / Supabase",
    items: [
      ["NEXT_PUBLIC_SUPABASE_URL", stateOf("NEXT_PUBLIC_SUPABASE_URL")],
      [
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        stateOf("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      ],
      ["SUPABASE_SERVICE_ROLE_KEY", stateOf("SUPABASE_SERVICE_ROLE_KEY", 32)],
      ["NEXT_PUBLIC_SITE_URL", stateOf("NEXT_PUBLIC_SITE_URL")],
    ],
  },
  {
    name: "Stripe test",
    items: [
      ["STRIPE_SECRET_KEY", stateOf("STRIPE_SECRET_KEY")],
      ["STRIPE_WEBHOOK_SECRET", stateOf("STRIPE_WEBHOOK_SECRET", 16)],
      [
        "checkout cancel signing secret",
        effectiveSecretState(
          "CHECKOUT_CANCEL_SECRET",
          "STRIPE_WEBHOOK_SECRET",
          16,
        ),
      ],
    ],
  },
  {
    name: "Desktop device authorization",
    items: [
      [
        "rate limit signing secret",
        effectiveSecretState(
          "DESKTOP_AUTH_RATE_LIMIT_SECRET",
          "SUPABASE_SERVICE_ROLE_KEY",
          32,
        ),
      ],
    ],
  },
  {
    name: "Supabase staging database",
    items: [
      [
        "MANGAI_DB_ENV=staging",
        environment.MANGAI_DB_ENV === "staging" ? "configured" : "missing",
      ],
      ["PGHOST", stateOf("PGHOST")],
      ["MANGAI_STAGING_PROJECT_REF", stateOf("MANGAI_STAGING_PROJECT_REF")],
      ["PGPORT", stateOf("PGPORT")],
      ["PGDATABASE", stateOf("PGDATABASE")],
      ["PGUSER", stateOf("PGUSER")],
      ["PGPASSWORD", stateOf("PGPASSWORD")],
      ["PGSSLMODE", stateOf("PGSSLMODE")],
      ["psql command", commandAvailable("psql") ? "configured" : "missing"],
    ],
  },
];

const staticPaths = [
  "package.json",
  "apps/desktop/package.json",
  "docs/desktop/RC_ACCEPTANCE_STATUS.json",
  "supabase/migrations/manifest.json",
  "supabase/tests/assert_staging_schema.sql",
];
const missingPaths = staticPaths.filter(
  (relativePath) => !fs.existsSync(path.join(root, relativePath)),
);

console.log("MANGAI release candidate preflight");
console.log("===================================");
console.log(
  `Repository structure: ${missingPaths.length === 0 ? "READY" : "NOT READY"}`,
);
for (const missingPath of missingPaths)
  console.log(`  [missing] ${missingPath}`);

console.log("\nExternal-service configuration (values are hidden)");
for (const check of checks) {
  const ready = check.items.every(([, state]) => state === "configured");
  console.log(`${ready ? "[READY]" : "[PENDING]"} ${check.name}`);
  for (const [label, state] of check.items)
    console.log(`  ${state === "configured" ? "[ok]" : `[${state}]`} ${label}`);
}

console.log("\nManual acceptance required");
console.log("  [manual] Ollama connection and Creator Chat response");
console.log(
  "  [manual] ComfyUI connection, generation, cancellation, and asset import",
);
console.log("  [manual] Multi-page PDF, image ZIP, and sales-package contents");
console.log(
  "  [manual] Hub staging import, device authorization, and Stripe test checkout",
);

let acceptanceErrors = [];
const acceptancePath = path.join(
  root,
  "docs",
  "desktop",
  "RC_ACCEPTANCE_STATUS.json",
);
if (fs.existsSync(acceptancePath)) {
  try {
    const acceptance = readAcceptanceRecord(acceptancePath);
    acceptanceErrors = acceptance.errors;
    const summary = summarizeAcceptance(acceptance.document);
    console.log(
      `  Record: ${summary.counts.passed} passed, ${summary.counts.waived} waived, ${summary.counts.pending} pending, ${summary.counts.blocked} blocked`,
    );
  } catch (error) {
    acceptanceErrors = [error.message];
  }
}
for (const error of acceptanceErrors)
  console.log(`  [invalid record] ${error}`);

const localGates = [
  ["Desktop typecheck", ["--prefix", "apps/desktop", "run", "typecheck"]],
  ["Desktop lint", ["--prefix", "apps/desktop", "run", "lint"]],
  ["Desktop integration tests", ["--prefix", "apps/desktop", "run", "test"]],
  ["Desktop renderer build", ["--prefix", "apps/desktop", "run", "build"]],
  ["Hub typecheck", ["run", "typecheck"]],
  ["Hub lint", ["run", "lint"]],
  ["Hub tests", ["run", "hub:test"]],
  ["Hub production build", ["run", "build"]],
  ["Migration validation", ["run", "db:migrations:validate"]],
];

let localFailure = missingPaths.length > 0 || acceptanceErrors.length > 0;
if (runFullValidation && !localFailure) {
  const npmExecutable = process.env.npm_execpath
    ? {
        command: process.execPath,
        leadingArgs: [process.env.npm_execpath],
      }
    : { command: "npm", leadingArgs: [] };
  console.log("\nComplete local quality gate");
  for (const [name, commandArgs] of localGates) {
    console.log(`\n>>> ${name}`);
    const result = spawnSync(
      npmExecutable.command,
      [...npmExecutable.leadingArgs, ...commandArgs],
      {
        cwd: root,
        stdio: "inherit",
        windowsHide: true,
      },
    );
    if (result.error) {
      console.error(
        `${name}: unable to start (${result.error.code ?? "error"})`,
      );
      localFailure = true;
      break;
    }
    if (result.status !== 0) {
      console.error(`${name}: FAILED`);
      localFailure = true;
      break;
    }
    console.log(`${name}: PASSED`);
  }
} else if (!runFullValidation) {
  console.log("\nLocal quality gate: not run (use npm run rc:validate)");
}

const externalPending = checks.some((check) =>
  check.items.some(([, state]) => state !== "configured"),
);

console.log("\nPreflight result");
if (localFailure) console.log("  Local readiness: FAILED");
else if (runFullValidation) console.log("  Local readiness: PASSED");
else console.log("  Local readiness: STRUCTURE READY (full gate not run)");
console.log(
  `  External configuration: ${externalPending ? "PENDING" : "READY"}`,
);
console.log("  Manual E2E: REQUIRED");

if (localFailure || (strictExternalReadiness && externalPending))
  process.exit(1);
