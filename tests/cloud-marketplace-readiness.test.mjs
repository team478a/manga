import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("販売artifact生成入口は完成原稿preflightを必須にする", async () => {
  const source = await read(
    "src/modules/cloud-creator/export/prepare-project-export.ts",
  );
  const functionStart = source.indexOf(
    "export async function createCloudMarketplaceArtifacts",
  );
  const functionSource = source.slice(functionStart);
  const preflightIndex = functionSource.indexOf("getCloudManuscriptPreflight");
  const assertionIndex = functionSource.indexOf(
    "assertCloudMarketplaceManuscriptReady",
  );
  const stagingIndex = functionSource.indexOf("stageExport(projectId)");

  assert.ok(functionStart >= 0);
  assert.ok(preflightIndex >= 0);
  assert.match(functionSource, /requireFinalizedPages:\s*true/);
  assert.ok(assertionIndex > preflightIndex);
  assert.ok(stagingIndex > assertionIndex);
});

test("Creator画面は同じpreflightが未合格なら販売操作を無効化する", async () => {
  const page = await read("src/app/creator/[projectId]/page.tsx");

  assert.match(page, /const marketplaceReady = Boolean\(exportReadiness\?\.ready\)/);
  assert.match(page, /disabled=\{!marketplaceReady\}/);
  assert.match(page, /原稿の完成状況を確認できないため、販売下書きは作成できません/);
  assert.match(page, /原稿チェックの要修正\{exportReadiness\.errorCount\}件/);
});
