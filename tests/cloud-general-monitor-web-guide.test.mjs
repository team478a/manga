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
    "市場分析",
    "AI企画提案",
    "シナリオ作成",
    "ネーム作成",
    "原稿編集",
    "作品管理",
    "漫画原稿を完成させる手順",
    "人物・画風・世界観を固定する",
    "章・話・シーン・ページを並べる",
    "参照画像を登録してコマへ割り当てる",
    "4〜8ページずつ制作状態を進める",
    "全ページを確定してPDFを書き出す",
    "完成の目印",
    "販売準備",
    "収益管理",
    "スマートフォンで操作する方へ",
    "感想・不具合の送り方",
    "困ったとき",
    "安全上の注意",
    "購入者向けの先行提供です",
    "一般的なモニター募集ではありません",
    "購入者としての権利や正式リリース後の利用資格は失われません",
  ]) {
    assert.match(source, new RegExp(text.replace("・", "・")));
  }
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /details/);
  assert.match(source, /dashboard\/research\/new/);
  assert.match(source, /dashboard\/workflow\/proposal/);
  assert.match(source, /dashboard\/workflow\/scenario/);
  assert.match(source, /dashboard\/workflow\/storyboard/);
  assert.match(source, /href: "\/creator"/);
  assert.match(source, /href="\/creator"/);
  assert.match(source, /href: "\/dashboard\/works"/);
  assert.match(source, /availability: "coming-soon"/);
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
    "今回確認する8工程",
  ]) {
    assert.match(guide, new RegExp(text));
  }
  assert.match(guide, /admin\/users/);
  assert.match(guide, /admin\/general-monitors\/email/);
  assert.match(guide, /admin\/general-monitors\/export/);
  assert.match(guide, /販売準備と収益管理は「準備中」/);
  assert.match(admin, /admin\/general-monitors\/guide/);
});
