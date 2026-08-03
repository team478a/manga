import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("更新情報管理はDB接続失敗を画面内の安全な状態へ変換する", async () => {
  const page = await readFile(
    new URL("../src/app/admin/product-updates/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /async function loadProductUpdates/);
  assert.match(page, /catch \(error\)/);
  assert.match(page, /unavailable: true/);
  assert.match(page, /更新情報を一時的に読み込めませんでした/);
  assert.match(page, /disabled=\{unavailable\}/);
  assert.match(page, /const \{ updates, unavailable \} = await loadProductUpdates\(\)/);
});

test("更新情報の保存と公開変更はProvider例外を安全な案内へ変換する", async () => {
  const actions = await readFile(
    new URL("../src/app/admin/product-updates/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(actions, /let saveFailed = false/);
  assert.match(actions, /let updateFailed = false/);
  assert.match(actions, /catch \{/);
  assert.match(actions, /設定を確認してもう一度お試しください/);
  assert.doesNotMatch(actions, /error\.message/);
});

test("予期しない描画失敗でも日本語の回復画面を表示する", async () => {
  const boundary = await readFile(
    new URL("../src/app/admin/product-updates/error.tsx", import.meta.url),
    "utf8",
  );

  assert.match(boundary, /更新情報を読み込めませんでした/);
  assert.match(boundary, /もう一度読み込む/);
  assert.match(boundary, /管理画面TOPへ/);
  assert.doesNotMatch(boundary, /error\.message/);
});
