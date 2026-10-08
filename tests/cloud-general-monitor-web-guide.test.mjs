import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("利用者向けWebマニュアルは制作完走とモバイル操作を案内する", async () => {
  const [source, operationVideo, creatorIndex, creatorProject] =
    await Promise.all([
      readFile(
        new URL("../src/app/dashboard/monitor/guide/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/app/dashboard/monitor/guide/CloudCreatorOperationVideo.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("../src/app/creator/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../src/app/creator/[projectId]/page.tsx", import.meta.url),
        "utf8",
      ),
    ]);
  for (const text of [
    "最初の5分で行うこと",
    "画面を見ながら漫画を完成させる",
    "実際の画面を基に、個人名・作品内容・利用枠を含まない画面例",
    "ダッシュボードから市場分析を始める",
    "企画・シナリオ・ネームを順番に採用する",
    "原稿編集で人物・画風・参照画像を固定する",
    "ページを選び、見積りと停止理由を確認する",
    "全ページを確定し、完成原稿PDFを書き出す",
    "最初から順番に見るステップ別動画マニュアル",
    "市場分析から収益管理までを8本に分けました",
    "実画面に沿った動画・日本語字幕付き",
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
    "MANGAI内で限定テスト販売する",
    "販売下書きを作成する",
    "管理者の対象指定を待つ",
    "指定購入者が確認する",
    "販売者本人の自己購入はできません",
    "テスト注文は本番の受取予定額に含まれません",
    "完成した漫画を出品する",
    "一般向け漫画・外部販売サイト",
    "一般公開販売・振込・精算確定は準備中です",
    "外部販売サイトへ手動登録する",
    "出品前チェック",
    "KDPへ電子漫画を出品する",
    "BOOTHへ電子漫画を出品する",
    "商品情報の下書きテンプレート",
    "AI生成画像を含む場合は、KDPの質問へ正確に申告",
    "本人確認、口座、税務情報は販売サイト上で本人が入力",
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
  for (const image of [
    "01-dashboard.svg",
    "02-workflow.svg",
    "03-creator-project.svg",
    "04-generation-preflight.svg",
    "05-export.svg",
    "08-sales-package.svg",
    "09-external-listing.svg",
  ]) {
    assert.match(source, new RegExp(image.replace(".", "\\.")));
  }
  assert.match(source, /<Image/);
  assert.match(source, /alt=\{item\.alt\}/);
  assert.match(source, /details/);
  assert.match(source, /dashboard\/research\/new/);
  assert.match(source, /dashboard\/workflow\/proposal/);
  assert.match(source, /dashboard\/workflow\/scenario/);
  assert.match(source, /dashboard\/workflow\/storyboard/);
  assert.match(source, /href: "\/creator"/);
  assert.match(source, /href="\/creator"/);
  assert.match(source, /href: "\/dashboard\/works"/);
  assert.match(source, /availability: "limited"/);
  assert.match(source, /dashboard\/monitor/);
  assert.match(source, /id="internal-test-sale"/);
  assert.match(source, /href="\/dashboard\/sales"/);
  assert.match(source, /id="sales-listing"/);
  assert.match(source, /kdp\.amazon\.co\.jp/);
  assert.match(source, /kdp\.amazon\.com\/en_US\/help\/topic\/G200672390/);
  assert.match(source, /booth\.pm\/guide/);
  assert.match(source, /booth\.pixiv\.help/);
  assert.match(source, /id="creator-operation-video"/);
  assert.match(source, /<CloudCreatorOperationVideo \/>/);
  for (const text of [
    "市場分析",
    "AI企画提案",
    "シナリオ作成",
    "ネーム作成",
    "原稿編集",
    "作品管理",
    "販売準備",
    "収益管理",
    "音声なし・日本語字幕付き・実画面に沿った匿名化表示",
    "この動画を保存",
  ]) {
    assert.match(operationVideo, new RegExp(text.replace("・", "・")));
  }
  assert.equal((operationVideo.match(/<video/g) ?? []).length, 1);
  assert.match(operationVideo, /manuals\.map/);
  assert.match(operationVideo, /<details/);
  assert.match(operationVideo, /open=\{manual\.number === 1\}/);
  assert.match(operationVideo, /controls/);
  assert.match(operationVideo, /playsInline/);
  for (const id of [
    "01-market-analysis-guide",
    "02-proposal-guide",
    "03-scenario-guide",
    "04-storyboard-guide",
    "cloud-creator-operation-guide",
    "06-work-management-guide",
    "07-sales-preparation-guide",
    "08-sales-management-guide",
  ]) {
    assert.match(operationVideo, new RegExp(id));
  }
  assert.match(operationVideo, /kind="captions"/);
  assert.match(operationVideo, /srcLang="ja"/);
  assert.match(operationVideo, /download=/);
  assert.doesNotMatch(operationVideo, /currentTime/);
  assert.match(creatorIndex, /guide#creator-operation-video/);
  assert.match(creatorProject, /guide#creator-operation-video/);
  assert.doesNotMatch(source, /APIキーを入力|出典URLを入力/);
});

test("8工程の動画マニュアルは配信可能なMP4・poster・日本語字幕を含む", async () => {
  const base = new URL("../public/manual/cloud/", import.meta.url);
  const manualIds = [
    "01-market-analysis-guide",
    "02-proposal-guide",
    "03-scenario-guide",
    "04-storyboard-guide",
    "cloud-creator-operation-guide",
    "06-work-management-guide",
    "07-sales-preparation-guide",
    "08-sales-management-guide",
  ];
  const generator = await readFile(
    new URL("../scripts/build-cloud-operation-video.mjs", import.meta.url),
    "utf8",
  );
  for (const id of manualIds) {
    const [video, poster, captions] = await Promise.all([
      stat(new URL(`${id}.mp4`, base)),
      stat(new URL(`${id}-poster.webp`, base)),
      readFile(new URL(`${id}.vtt`, base), "utf8"),
    ]);
    assert.ok(video.size > 100_000, `${id}.mp4 is unexpectedly small`);
    assert.ok(video.size < 10_000_000, `${id}.mp4 is unexpectedly large`);
    assert.ok(poster.size > 10_000, `${id} poster is unexpectedly small`);
    assert.match(captions, /^WEBVTT/m);
    assert.doesNotMatch(captions, /@|API[_ -]?KEY|Bearer|ma2025/i);
  }
  assert.match(
    await readFile(new URL("01-market-analysis-guide.vtt", base), "utf8"),
    /ダッシュボードから開始/,
  );
  assert.match(
    await readFile(new URL("cloud-creator-operation-guide.vtt", base), "utf8"),
    /全ページを確定してPDF保存/,
  );
  for (const image of [
    "03-creator-project.svg",
    "04-generation-preflight.svg",
    "05-export.svg",
    "06-candidate-review.svg",
    "07-dialogue-edit.svg",
  ]) {
    assert.match(generator, new RegExp(image.replace(".", "\\.")));
  }
  assert.match(generator, /\.tmp-cloud-operation-video/);
  assert.match(generator, /MANGAI_FFMPEG_PATH/);
  assert.doesNotMatch(generator, /\bfetch\s*\(|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
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
      new URL("../src/app/admin/general-monitors/page.tsx", import.meta.url),
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
  assert.match(guide, /販売準備と収益管理は対象者限定で段階提供/);
  assert.match(admin, /admin\/general-monitors\/guide/);
});
