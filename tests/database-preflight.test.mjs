import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "check-supabase-staging.mjs");
const run = (overrides) =>
  spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      MANGAI_DB_ENV: "staging",
      PGDATABASE: "postgres",
      PGUSER: "postgres",
      ...overrides,
    },
    encoding: "utf8",
  });

test("staging preflight rejects a Supabase Project reference mismatch", () => {
  const result = run({
    PGHOST: "db.production-project.supabase.co",
    MANGAI_STAGING_PROJECT_REF: "staging-project",
    MANGAI_DB_LOCAL_TEST: "",
  });
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /PGHOST or PGUSER does not match MANGAI_STAGING_PROJECT_REF/,
  );
});

test("staging preflight local-test bypass accepts only loopback", () => {
  const result = run({
    PGHOST: "db.example.supabase.co",
    MANGAI_DB_LOCAL_TEST: "1",
    MANGAI_STAGING_PROJECT_REF: "",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /allowed only for a loopback database/);
});

test("staging preflight requires an explicit Project reference", () => {
  const result = run({
    PGHOST: "db.example.supabase.co",
    MANGAI_DB_LOCAL_TEST: "",
    MANGAI_STAGING_PROJECT_REF: "",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MANGAI_STAGING_PROJECT_REF/);
});
