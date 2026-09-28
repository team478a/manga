import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("管理画面はadmin認証後にpublication migration readinessを読み取る", async () => {
  const page = await readFile(
    "src/app/admin/marketplace-canary/page.tsx",
    "utf8",
  );
  const authIndex = page.indexOf("await requireAdmin()");
  const readinessIndex = page.indexOf(
    "loadAdminMarketplacePublicationMigrationReadiness()",
  );

  assert.ok(authIndex >= 0);
  assert.ok(readinessIndex > authIndex);
  assert.match(page, /Cloud完成版migration 適用前確認/);
  assert.match(page, /Production資格情報を端末へ取り出さず/);
  assert.match(page, /この画面からmigrationは適用できません/);
  assert.match(page, /確認はSELECTのみ/);
  assert.match(page, /責任者の明示承認後に、別工程で1回だけ適用/);
  assert.doesNotMatch(page, /serviceRoleKey|SUPABASE_SERVICE_ROLE_KEY/);
});

test("管理画面repositoryはProduction guard後にSELECTだけを組み立てる", async () => {
  const source = await readFile(
    "src/modules/checkout/infrastructure/admin-publication-migration-readiness-repository.ts",
    "utf8",
  );
  const runtimeIndex = source.indexOf(
    "assertMarketplaceProductionCanaryRuntime(environment)",
  );
  const clientIndex = source.indexOf("createAdminClient()", runtimeIndex);

  assert.ok(runtimeIndex >= 0);
  assert.ok(clientIndex > runtimeIndex);
  assert.match(source, /\.from\(relation\)\.select\(columns\)\.limit\(0\)/);
  assert.match(source, /\.from\("works"\)/);
  assert.match(source, /\.from\("digital_products"\)/);
  assert.match(source, /current_publication_id,published_version,published_at/);
  assert.match(source, /cloud_work_publications/);
  assert.match(source, /cloud_work_publication_pages/);
  assert.match(source, /maximumMarketplacePublicationMigrationInventoryRows \+ 1/);
  assert.match(source, /MarketplacePublicationMigrationReadError/);
  assert.doesNotMatch(
    source,
    /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(|stripe/i,
  );
  assert.doesNotMatch(source, /email|display_name|buyer_email|storage_path/);
});

test("CLIと管理画面は同じ副作用なし判定を共有する", async () => {
  const cli = await readFile(
    "scripts/check-marketplace-publication-migration-readiness.mjs",
    "utf8",
  );
  const repository = await readFile(
    "src/modules/checkout/infrastructure/admin-publication-migration-readiness-repository.ts",
    "utf8",
  );

  assert.match(
    cli,
    /from "\.\.\/src\/modules\/checkout\/domain\/publication-migration-readiness\.ts"/,
  );
  assert.match(
    repository,
    /@\/modules\/checkout\/domain\/publication-migration-readiness/,
  );
  assert.match(cli, /assessMarketplacePublicationMigrationReadiness/);
  assert.match(repository, /assessMarketplacePublicationMigrationReadiness/);
});
