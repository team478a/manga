import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cloudGeneralImagePricingVersion } from "../src/lib/cloud-general-image-settings.ts";

test("FLUX.2 Proだけを参照生成対応の新pricing versionへ切り替える", () => {
  assert.equal(cloudGeneralImagePricingVersion("flux-2-pro"), "bfl-flux2-pro-2026-08");
  assert.equal(cloudGeneralImagePricingVersion("flux-2-klein-9b"), "bfl-flux2-2026-03");
  assert.equal(cloudGeneralImagePricingVersion("flux-2-max"), "bfl-flux2-2026-03");
});

test("追加migrationは4用途を最大4MPの$0.180で予約しrollbackは新versionだけを除く", async () => {
  const migration = await readFile("supabase/migrations/202608250006_bfl_flux2_pro_cost_guard.sql", "utf8");
  const rollback = await readFile("supabase/rollbacks/202608250006_bfl_flux2_pro_cost_guard.sql", "utf8");
  assert.match(migration, /'bfl-flux2-pro-2026-08'/);
  assert.match(migration, /180000/);
  for (const jobType of ["background", "prop", "effect", "character_base"])
    assert.match(migration, new RegExp(`'${jobType}'`));
  assert.match(migration, /on conflict/);
  assert.match(rollback, /delete from public\.cloud_ai_provider_prices/);
  assert.match(rollback, /pricing_version = 'bfl-flux2-pro-2026-08'/);
  assert.doesNotMatch(rollback, /bfl-flux2-2026-03/);
});
