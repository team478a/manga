import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  assessExternalEnvironments,
  probeReadOnlyEndpoint,
} from "../scripts/check-rc-external-environments.mjs";

test("reports missing external environments without exposing values", () => {
  const checks = assessExternalEnvironments({
    environment: {},
    commands: { ollama: false, psql: false },
  });

  assert.deepEqual(
    checks.map(({ id, ready }) => [id, ready]),
    [
      ["ollama", false],
      ["comfyui", false],
      ["supabase-staging", false],
    ],
  );
  assert.ok(checks.every((check) => !JSON.stringify(check).includes("secret")));
});

test("requires the complete isolated staging contract", () => {
  const checks = assessExternalEnvironments({
    environment: {
      MANGAI_DB_ENV: "staging",
      MANGAI_STAGING_PROJECT_REF: "preview-ref",
      MANGAI_STAGING_PARENT_PROJECT_REF: "parent-ref",
      PGHOST: "db.preview-ref.example.invalid",
      PGPORT: "5432",
      PGDATABASE: "postgres",
      PGUSER: "postgres",
      PGPASSWORD: "hidden",
      PGSSLMODE: "require",
    },
    commands: { ollama: true, psql: true },
  });

  assert.equal(checks.find((check) => check.id === "ollama").ready, true);
  assert.equal(
    checks.find((check) => check.id === "supabase-staging").ready,
    true,
  );
});

test("rejects a database target that does not match the isolated branch ref", () => {
  const checks = assessExternalEnvironments({
    environment: {
      MANGAI_DB_ENV: "staging",
      MANGAI_STAGING_PROJECT_REF: "branch-ref",
      MANGAI_STAGING_PARENT_PROJECT_REF: "parent-ref",
      PGHOST: "db.parent-ref.example.invalid",
      PGPORT: "5432",
      PGDATABASE: "postgres",
      PGUSER: "postgres",
      PGPASSWORD: "hidden",
      PGSSLMODE: "require",
    },
    commands: { ollama: false, psql: true },
  });
  const staging = checks.find((check) => check.id === "supabase-staging");

  assert.equal(staging.ready, false);
  assert.deepEqual(staging.missing, [
    "PGHOST or PGUSER matches isolated staging branch ref",
  ]);
});

test("rejects malformed staging project references before connection", () => {
  const checks = assessExternalEnvironments({
    environment: {
      MANGAI_DB_ENV: "staging",
      MANGAI_STAGING_PROJECT_REF: "bad ref",
      MANGAI_STAGING_PARENT_PROJECT_REF: "parent-ref",
      PGHOST: "db.bad-ref.example.invalid",
      PGPORT: "5432",
      PGDATABASE: "postgres",
      PGUSER: "postgres",
      PGPASSWORD: "hidden",
      PGSSLMODE: "require",
    },
    commands: { ollama: false, psql: true },
  });
  const staging = checks.find((check) => check.id === "supabase-staging");

  assert.equal(staging.ready, false);
  assert.deepEqual(staging.missing, [
    "valid staging branch and parent project refs",
  ]);
});

test("rejects the parent Supabase main as an isolated staging branch", () => {
  const checks = assessExternalEnvironments({
    environment: {
      MANGAI_DB_ENV: "staging",
      MANGAI_STAGING_PROJECT_REF: "same-ref",
      MANGAI_STAGING_PARENT_PROJECT_REF: "same-ref",
      PGHOST: "db.example.invalid",
      PGPORT: "5432",
      PGDATABASE: "postgres",
      PGUSER: "postgres",
      PGPASSWORD: "hidden",
      PGSSLMODE: "require",
    },
    commands: { ollama: false, psql: true },
  });
  const staging = checks.find((check) => check.id === "supabase-staging");

  assert.equal(staging.ready, false);
  assert.deepEqual(staging.missing, [
    "isolated staging branch ref differs from parent project ref",
  ]);
});

test("read-only probe only performs GET and reports reachability", async () => {
  let request;
  const result = await probeReadOnlyEndpoint("http://127.0.0.1:8188", "/system_stats", {
    fetchImpl: async (url, options) => {
      request = { url: String(url), method: options.method };
      return { ok: true, status: 200 };
    },
  });

  assert.deepEqual(request, {
    url: "http://127.0.0.1:8188/system_stats",
    method: "GET",
  });
  assert.deepEqual(result, { ok: true, status: 200 });
});

test("main RC preflight includes external E2E readiness without probing", () => {
  const result = spawnSync(process.execPath, ["scripts/check-release-candidate.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OLLAMA_HOST: "",
      COMFYUI_URL: "",
      MANGAI_DB_ENV: "",
      MANGAI_STAGING_PROJECT_REF: "",
      MANGAI_STAGING_PARENT_PROJECT_REF: "",
      PATH: "",
    },
    windowsHide: true,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /External E2E environment readiness/);
  assert.match(result.stdout, /\[PENDING\] Ollama実環境E2E/);
  assert.match(result.stdout, /\[PENDING\] ComfyUI実環境E2E/);
  assert.doesNotMatch(result.stdout, /\[probe\]/);
});
