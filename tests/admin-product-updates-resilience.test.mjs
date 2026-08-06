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

test("更新情報Actionは日本語の結果メッセージを安全にURLへ渡す", async () => {
  const actions = await readFile(
    new URL("../src/app/admin/product-updates/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(actions, /const productUpdatesTarget/);
  assert.match(actions, /actionFeedbackTarget\("\/admin\/product-updates", kind, text\)/);
  assert.match(actions, /productUpdatesTarget\("message", "更新情報を保存しました"\)/);
  assert.match(actions, /productUpdatesTarget\("error", "更新情報を保存できませんでした/);
  assert.doesNotMatch(actions, /redirect\("\/admin\/product-updates\?(?:message|error)=[^"$]/);
});

test("更新情報は短時間の同一内容を二重登録しない", async () => {
  const actions = await readFile(
    new URL("../src/app/admin/product-updates/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(actions, /Date\.now\(\) - 10 \* 60 \* 1000/);
  assert.match(actions, /\.eq\("created_by_profile_id", profile\.id\)/);
  assert.match(actions, /\.is\("archived_at", null\)/);
  assert.match(actions, /\.some\(\(update\) => isSameProductUpdate\(update, parsed\.data\)\)/);
  assert.match(actions, /同じ更新情報はすでに保存されています/);
  assert.match(actions, /二重登録の確認ができませんでした/);
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

test("管理者は更新情報を安全に編集できる", async () => {
  const [listPage, editPage, actions] = await Promise.all([
    readFile(new URL("../src/app/admin/product-updates/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/product-updates/[updateId]/edit/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/product-updates/actions.ts", import.meta.url), "utf8"),
  ]);

  assert.match(listPage, /href=\{`\/admin\/product-updates\/\$\{item\.id\}\/edit`\}/);
  assert.match(editPage, /更新情報を編集/);
  assert.match(editPage, /PendingSubmitButton/);
  assert.match(editPage, /z\.string\(\)\.uuid\(\)/);
  assert.match(editPage, /\.is\("archived_at", null\)/);
  assert.match(actions, /export async function editProductUpdateAction/);
  assert.match(actions, /\.select\("id"\)\s*\.maybeSingle\(\)/);
  assert.match(actions, /revalidatePath\("\/dashboard"\)/);
  assert.match(actions, /更新情報を編集しました/);
});
