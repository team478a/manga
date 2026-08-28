import assert from "node:assert/strict";
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
      PGHOST: "db.example.invalid",
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
