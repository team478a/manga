import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { provisionMarketplaceRealWorkStagingFixture } from "../scripts/provision-marketplace-real-work-staging-fixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(
  path.join(root, "scripts/provision-marketplace-real-work-staging-fixture.mjs"),
  "utf8",
);

test("隔離Staging設定がなければ通信前にprovisionを拒否する", async () => {
  await assert.rejects(
    provisionMarketplaceRealWorkStagingFixture({}),
    /Missing staging environment: MANGAI_DB_ENV/,
  );
});

test("2ページの制作構造・Canvas・private assetを冪等に準備する", () => {
  assert.match(source, /ensurePrivateImageBucket\(target, "cloud-assets"\)/);
  assert.match(source, /"cloud_chapters"/);
  assert.match(source, /"cloud_episodes"/);
  assert.match(source, /"cloud_scenes"/);
  assert.match(source, /"cloud_pages"/);
  assert.match(source, /"cloud_canvas_snapshots"/);
  assert.match(source, /production_status: "finalized"/);
});

test("再実行時に既存合成アカウントのpasswordを更新・返却しない", () => {
  assert.doesNotMatch(source, /Refresh .* staging auth password/);
  assert.doesNotMatch(source, /credentials\s*:/);
  assert.match(source, /return \{ email, userId: user\.id \}/);
});
