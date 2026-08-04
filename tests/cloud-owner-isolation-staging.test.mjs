import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateReadIsolation,
  REQUIRED_ACCEPTANCE_ENV,
  validateAcceptanceEnvironment,
} from "../scripts/check-cloud-owner-isolation-staging.mjs";

function validEnvironment() {
  return Object.fromEntries(
    REQUIRED_ACCEPTANCE_ENV.map((name) => [
      name,
      name === "MANGAI_DB_ENV"
        ? "staging"
        : name === "MANGAI_OWNER_TEST_CONFIRM"
          ? "READ_ONLY_STAGING"
          : name === "MANGAI_OWNER_TEST_SUPABASE_URL"
            ? "https://example.supabase.co"
            : "configured",
    ]),
  );
}

test("owner isolation staging preflight requires every secret without exposing values", () => {
  const environment = validEnvironment();
  delete environment.MANGAI_OWNER_TEST_USER_B_PASSWORD;
  const result = validateAcceptanceEnvironment(environment);
  assert.equal(result.passed, false);
  assert.deepEqual(result.missing, ["MANGAI_OWNER_TEST_USER_B_PASSWORD"]);
  assert.equal(JSON.stringify(result).includes("configured"), false);
});

test("owner isolation staging preflight fails closed outside staging", () => {
  const environment = validEnvironment();
  environment.MANGAI_DB_ENV = "production";
  const result = validateAcceptanceEnvironment(environment);
  assert.equal(result.passed, false);
  assert.ok(result.errors.includes("target:not-staging"));
});

test("owner isolation staging preflight accepts an explicit read-only staging target", () => {
  assert.equal(validateAcceptanceEnvironment(validEnvironment()).passed, true);
});

test("read isolation passes only when owner sees one row and outsider sees none", () => {
  const result = evaluateReadIsolation([
    { resource: "cloud_projects", ownerCount: 1, outsiderCount: 0 },
    { resource: "cloud_export_jobs", ownerCount: 1, outsiderCount: 1 },
  ]);
  assert.equal(result[0].passed, true);
  assert.equal(result[1].passed, false);
});
