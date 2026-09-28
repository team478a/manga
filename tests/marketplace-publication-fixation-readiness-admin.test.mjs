import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("管理画面はadmin認証後に完成版固定readinessを読み取る", async () => {
  const page = await readFile("src/app/admin/marketplace-canary/page.tsx", "utf8");
  const authIndex = page.indexOf("await requireAdmin()");
  const readinessIndex = page.indexOf(
    "loadAdminMarketplacePublicationFixationReadiness()",
  );

  assert.ok(authIndex >= 0);
  assert.ok(readinessIndex > authIndex);
  assert.match(page, /Cloud完成版固定の準備確認/);
  assert.match(page, /同期RPCやStorage object取得は行いません/);
  assert.match(page, /この画面から完成版固定は実行できません/);
});

test("固定準備repositoryはProduction guard後にSELECTだけを行う", async () => {
  const source = await readFile(
    "src/modules/checkout/infrastructure/admin-publication-fixation-readiness-repository.ts",
    "utf8",
  );
  const runtimeIndex = source.indexOf(
    "assertMarketplaceProductionCanaryRuntime(environment)",
  );
  const clientIndex = source.indexOf("createAdminClient()", runtimeIndex);

  assert.ok(runtimeIndex >= 0);
  assert.ok(clientIndex > runtimeIndex);
  for (const table of [
    "works",
    "digital_products",
    "cloud_projects",
    "cloud_project_checkpoints",
    "cloud_project_checkpoint_pages",
  ]) {
    assert.match(source, new RegExp(`\\.from\\(\\"${table}\\"\\)`));
  }
  assert.doesNotMatch(
    source,
    /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(|storage\.|stripe/i,
  );
  assert.doesNotMatch(source, /email|display_name|title|description|storage_path/);
});
