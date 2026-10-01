import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildMarketplaceProductionSchemaAuditBundle,
  marketplaceProductionSchemaAuditMigrations,
} from "../scripts/check-marketplace-production-schema-audit.mjs";

const auditPath = "supabase/audits/marketplace_production_schema_readiness.sql";

test("Production schema監査Bundleは4 migrationの正本checksumを固定する", async () => {
  const report = await buildMarketplaceProductionSchemaAuditBundle();

  assert.equal(report.ready, true);
  assert.deepEqual(
    report.migrations.map((migration) => migration.id),
    marketplaceProductionSchemaAuditMigrations.map((migration) => migration.id),
  );
  assert.deepEqual(
    report.migrations,
    marketplaceProductionSchemaAuditMigrations,
  );
  assert.ok(
    report.migrations.every((migration) =>
      /^[a-f0-9]{64}$/.test(migration.sha256),
    ),
  );
  assert.match(report.audit.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(report.safety, {
    externalConnection: false,
    personalData: false,
    productionMutation: false,
    secretPrinted: false,
  });
});

test("Production schema監査SQLはcatalogをSELECTする1文だけで4契約を判定する", async () => {
  const sql = await readFile(auditPath, "utf8");
  const withoutLiterals = sql.replace(/'(?:''|[^'])*'/g, "''");

  assert.match(sql, /^with artifact_oids/i);
  assert.equal((sql.match(/;/g) ?? []).length, 1);
  assert.doesNotMatch(
    withoutLiterals,
    /\b(insert|update|delete|upsert|alter|create|drop|grant|revoke|truncate|call|do)\b/i,
  );
  assert.match(
    sql,
    /to_regprocedure\('public\.publish_cloud_marketplace_listing\(uuid\)'\)/,
  );
  assert.match(
    sql,
    /to_regprocedure\('public\.withdraw_cloud_marketplace_listing\(uuid\)'\)/,
  );
  assert.match(
    sql,
    /to_regprocedure\('public\.enforce_cloud_product_publication_gate\(\)'\)/,
  );
  assert.match(
    sql,
    /to_regprocedure\('public\.list_public_work_creator_attributions\(uuid\[\]\)'\)/,
  );
  assert.match(sql, /from pg_trigger/);
  assert.match(
    sql,
    /trigger_record\.tgfoid=function_contracts\.product_guard_oid/,
  );
  assert.match(sql, /has_function_privilege\('authenticated'/);
  assert.match(sql, /has_function_privilege\('anon'/);
  assert.match(sql, /APPLIED_CONTRACT_READY/);
  assert.match(sql, /NOT_APPLIED_OR_INCOMPLETE/);
  assert.match(sql, /end as readiness/);
  for (const migration of marketplaceProductionSchemaAuditMigrations) {
    assert.match(sql, new RegExp(migration.id));
  }
  assert.doesNotMatch(
    sql,
    /email|display_name|buyer_profile_id|file_url|storage_path/i,
  );
});

test("監査Bundle検証は外部接続・Production操作を実装しない", async () => {
  const [source, workflow] = await Promise.all([
    readFile("scripts/check-marketplace-production-schema-audit.mjs", "utf8"),
    readFile(".github/workflows/quality.yml", "utf8"),
  ]);

  assert.doesNotMatch(
    source,
    /fetch\(|createClient|SUPABASE|STRIPE|process\.env/,
  );
  assert.doesNotMatch(
    source,
    /\.from\(|\.insert\(|\.delete\(|\.upsert\(|\.rpc\(/i,
  );
  assert.match(source, /Production was not connected or changed/);
  assert.match(workflow, /Verify Production schema audit query/);
  assert.match(
    workflow,
    /psql -v ON_ERROR_STOP=1 -d current_schema -f supabase\/audits\/marketplace_production_schema_readiness\.sql/,
  );
});
