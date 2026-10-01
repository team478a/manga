import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const marketplaceProductionSchemaAuditMigrations = Object.freeze([
  Object.freeze({
    id: "202609290001_cloud_marketplace_listing_publish",
    sha256: "7cf041d4add68a08f994abb8a287159226574abb64da09d103ab7e085b959701",
  }),
  Object.freeze({
    id: "202609290002_cloud_marketplace_listing_withdrawal",
    sha256: "d16d53adb97bf255d6202b362182d1c0548e5f5a09ec953121a90c1fa7c5ea27",
  }),
  Object.freeze({
    id: "202609300001_cloud_marketplace_product_edit_guard",
    sha256: "307f35ca1e08e0232164c79a8b2206c487748046eec65a95fccd9f98c5fd644d",
  }),
  Object.freeze({
    id: "202609300002_public_marketplace_creator_attribution",
    sha256: "bdf4525991da2a180604be80b80d077e481919fd2c0eb4dfa9f5851cd4415d8f",
  }),
]);

const sha256 = (value) =>
  createHash("sha256").update(value.replace(/\r\n/g, "\n")).digest("hex");

export async function buildMarketplaceProductionSchemaAuditBundle({
  readFileFn = readFile,
  root = repositoryRoot,
} = {}) {
  const manifestPath = resolve(root, "supabase/migrations/manifest.json");
  const auditPath = resolve(
    root,
    "supabase/audits/marketplace_production_schema_readiness.sql",
  );
  const [manifestText, auditSql] = await Promise.all([
    readFileFn(manifestPath, "utf8"),
    readFileFn(auditPath, "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const manifestById = new Map(
    (manifest.migrations ?? []).map((entry) => [entry.id, entry]),
  );
  const migrations = [];

  for (const expected of marketplaceProductionSchemaAuditMigrations) {
    const { id } = expected;
    const entry = manifestById.get(id);
    if (!entry || !/^[a-f0-9]{64}$/.test(entry.forwardSha256 ?? "")) {
      throw new Error(
        `Marketplace schema audit manifest entry is invalid: ${id}`,
      );
    }
    const source = await readFileFn(
      resolve(root, `supabase/migrations/${id}.sql`),
      "utf8",
    );
    const actualSha256 = sha256(source);
    if (
      actualSha256 !== entry.forwardSha256 ||
      actualSha256 !== expected.sha256
    ) {
      throw new Error(`Marketplace schema audit checksum mismatch: ${id}`);
    }
    migrations.push({ id, sha256: actualSha256 });
  }

  if (!auditSql.trim().toLowerCase().startsWith("with ")) {
    throw new Error("Marketplace schema audit must be one read-only query.");
  }

  return {
    ready: true,
    migrations,
    audit: {
      sha256: sha256(auditSql),
      relativePath:
        "supabase/audits/marketplace_production_schema_readiness.sql",
    },
    safety: {
      externalConnection: false,
      personalData: false,
      productionMutation: false,
      secretPrinted: false,
    },
  };
}

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  try {
    const report = await buildMarketplaceProductionSchemaAuditBundle();
    console.log("MANGAI Marketplace Production schema audit bundle");
    console.log("=================================================");
    for (const migration of report.migrations) {
      console.log(`[READY] ${migration.id}`);
      console.log(`  SHA-256: ${migration.sha256}`);
    }
    console.log(`\nAudit SQL: ${report.audit.relativePath}`);
    console.log(`Audit SHA-256: ${report.audit.sha256}`);
    console.log(
      "Production was not connected or changed. Run the verified SELECT in the Production SQL Editor only after confirming this digest.",
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Marketplace schema audit bundle verification failed.",
    );
    process.exitCode = 1;
  }
}
