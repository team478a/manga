import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("利用者向けWebマニュアルは制作完走とモバイル操作を案内する", async () => {
  const source = await readFile(
    new URL(
      "../src/app/dashboard/monitor/guide/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const text of [
    "最初の5分で行うこと",
    "AI市場分析",
    "AI企画提案",
    "シナリオ生成",
    "AIネーム",
    "Canvas・コマ画像",
    "感想・不具合の送り方",
    "困ったとき",
    "安全上の注意",
  ]) {
    assert.match(source, new RegExp(text.replace("・", "・")));
  }
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /details/);
  assert.match(source, /dashboard\/research\/new/);
  assert.match(source, /dashboard\/monitor/);
  assert.doesNotMatch(source, /APIキーを入力|出典URLを入力/);
});

test("スタッフ向けWebマニュアルは約10名の招待・監視・停止を案内する", async () => {
  const [guide, admin] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/general-monitors/guide/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/general-monitors/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  for (const text of [
    "10名モニターテスト運用マニュアル",
    "開始前チェック",
    "10名を招待する手順",
    "スタッフの日次確認",
    "問い合わせ対応ルール",
    "停止判断",
    "テスト完了の目安",
  ]) {
    assert.match(guide, new RegExp(text));
  }
  assert.match(guide, /admin\/users/);
  assert.match(guide, /admin\/general-monitors\/email/);
  assert.match(guide, /admin\/general-monitors\/export/);
  assert.match(admin, /admin\/general-monitors\/guide/);
});
