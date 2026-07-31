import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("実装済み制作工程は利用者ごとの安全な入口から開く", async () => {
  const [page, resolver] = await Promise.all([
    readFile(
      new URL("../src/app/dashboard/workflow/[stage]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/cloud-workflow-entrypoints-server.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /proposal:[\s\S]*label: "AI企画提案"/);
  assert.match(page, /scenario:[\s\S]*label: "シナリオ作成"/);
  assert.match(page, /storyboard:[\s\S]*label: "ネーム作成"/);
  assert.match(page, /requireProfile/);
  assert.match(page, /前の工程を完了すると進めます/);
  assert.match(page, /この機能は現在停止中です/);
  assert.match(resolver, /contentClass === "general"/);
  assert.match(resolver, /getCloudProposalSelection\(profileId/);
  assert.match(resolver, /getLatestCloudScenarioAdoption/);
  assert.match(resolver, /owner_profile_id|profileId/);
});
