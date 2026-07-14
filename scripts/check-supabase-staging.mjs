import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assertionFile = path.join(
  root,
  "supabase",
  "tests",
  "assert_staging_schema.sql",
);

const help = `MANGAI Hub Supabase staging preflight

Required environment:
  MANGAI_DB_ENV=staging
  PGHOST, PGDATABASE, PGUSER
  PGPASSWORD or a configured pgpass file

Optional environment:
  PGPORT (default: 5432)
  PGSSLMODE (default: require)

This command is read-only and does not apply or roll back migrations.`;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(help);
  process.exit(0);
}

if (process.env.MANGAI_DB_ENV !== "staging") {
  console.error(
    "Refusing to run: set MANGAI_DB_ENV=staging for the staging database.",
  );
  process.exit(1);
}

const missing = ["PGHOST", "PGDATABASE", "PGUSER"].filter(
  (name) => !process.env[name]?.trim(),
);
if (missing.length > 0) {
  console.error(`Missing database environment: ${missing.join(", ")}`);
  process.exit(1);
}

const result = spawnSync(
  "psql",
  ["-X", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--file", assertionFile],
  {
    cwd: root,
    env: {
      ...process.env,
      PGAPPNAME: "mangai-staging-preflight",
      PGPORT: process.env.PGPORT || "5432",
      PGSSLMODE: process.env.PGSSLMODE || "require",
    },
    stdio: "inherit",
    windowsHide: true,
  },
);

if (result.error?.code === "ENOENT") {
  console.error("psql was not found. Install PostgreSQL client tools first.");
  process.exit(1);
}
if (result.error) {
  console.error(`Unable to start psql: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

console.log("Supabase staging preflight passed.");
