import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("利用者は公開済み更新情報の一覧と詳細を安全に確認できる", async () => {
  const [dashboard, listPage, detailPage, boundary] = await Promise.all([
    readFile(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/updates/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/updates/[updateId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/updates/error.tsx", import.meta.url), "utf8"),
  ]);

  for (const source of [dashboard, listPage, detailPage]) {
    assert.match(source, /\.not\("published_at", "is", null\)/);
    assert.match(source, /\.lte\("published_at", new Date\(\)\.toISOString\(\)\)/);
    assert.match(source, /\.is\("archived_at", null\)/);
  }
  assert.match(dashboard, /すべての更新を見る/);
  assert.match(listPage, /詳しく見る/);
  assert.match(detailPage, /z\.string\(\)\.uuid\(\)/);
  assert.match(detailPage, /isSafeInternalPath/);
  assert.match(detailPage, /詳しい内容/);
  assert.match(boundary, /もう一度読み込む/);
  assert.doesNotMatch(boundary, /error\.message/);
});
