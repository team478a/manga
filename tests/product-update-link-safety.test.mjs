import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { isSafeInternalPath } from "../src/lib/safe-internal-path.ts";

test("更新情報の関連画面はアプリ内パスだけを許可する", () => {
  for (const value of ["/dashboard", "/dashboard/research?from=update", "/creator#works"]) {
    assert.equal(isSafeInternalPath(value), true, value);
  }
  for (const value of [
    "https://app.mang-ai.com/dashboard",
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "javascript:alert(1)",
    "dashboard/research",
    "/dashboard\n/research",
    "",
  ]) {
    assert.equal(isSafeInternalPath(value), false, value);
  }
});

test("登録・編集・表示のすべてで共通のリンク検査を使う", async () => {
  const [actions, dashboard, createPage, editPage] = await Promise.all([
    readFile(new URL("../src/app/admin/product-updates/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/product-updates/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/product-updates/[updateId]/edit/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(actions, /isSafeInternalPath\(value\)/);
  assert.match(dashboard, /isSafeInternalPath\(item\.action_url\)/);
  assert.doesNotMatch(actions, /value\.startsWith\("https:\/\/"\)/);
  assert.match(createPage, /外部サイトのURLは登録できません/);
  assert.match(editPage, /外部サイトのURLは登録できません/);
});
