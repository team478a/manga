import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("企画提案画面は生成中・空・失敗・成功状態を利用者へ示す", async () => {
  const [handoff, button, comparison, loading, error, notFound] = await Promise.all([
    readSource("../src/app/dashboard/research/[reportId]/proposal/page.tsx"),
    readSource(
      "../src/app/dashboard/research/[reportId]/proposal/proposal-submit-button.tsx",
    ),
    readSource(
      "../src/app/dashboard/research/[reportId]/proposal/runs/[runId]/page.tsx",
    ),
    readSource(
      "../src/app/dashboard/research/[reportId]/proposal/loading.tsx",
    ),
    readSource(
      "../src/app/dashboard/research/[reportId]/proposal/error.tsx",
    ),
    readSource(
      "../src/app/dashboard/research/[reportId]/proposal/not-found.tsx",
    ),
  ]);
  assert.match(handoff, /企画はまだ作成されていません/);
  assert.match(handoff, /role="alert"/);
  assert.match(button, /AIが企画を作成中/);
  assert.match(button, /企画を保存中/);
  assert.match(comparison, /role="status"/);
  assert.match(comparison, /シナリオ生成の準備ができました/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /AI企画提案を読み込んでいます/);
  assert.match(error, /role="alert"/);
  assert.match(error, /内部情報は表示していません/);
  assert.doesNotMatch(error, /\{error\.(?:message|stack|digest)\}/);
  assert.match(notFound, /URLが不正、削除済み、または表示権限がない/);
});

test("企画比較画面は390pxで横幅を超える固定widthを持たない", async () => {
  const sources = await Promise.all([
    readSource("../src/app/dashboard/research/[reportId]/proposal/page.tsx"),
    readSource(
      "../src/app/dashboard/research/[reportId]/proposal/runs/[runId]/page.tsx",
    ),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /(?:min-|max-)?w-\[(?:39[1-9]|[4-9]\d{2,}|\d{4,})px\]/,
    );
  }
  assert.match(sources[1], /lg:grid-cols-3/);
  assert.match(sources[1], /grid-cols-1[\s\S]*sm:grid-cols-3/);
  assert.match(sources[1], /break-words/);
});

test("企画生成・選択ActionはFeature Flagを認証とDB処理より先に確認する", async () => {
  const actions = await readSource(
    "../src/app/dashboard/research/[reportId]/proposal/actions.ts",
  );
  for (const actionName of [
    "createCloudProposalAction",
    "selectCloudProposalAction",
  ]) {
    const start = actions.indexOf(`function ${actionName}`);
    const next = actions.indexOf("\nexport async function", start + 1);
    const source = actions.slice(start, next < 0 ? undefined : next);
    assert.ok(
      source.indexOf("cloudProposalFeatureEnabled()") <
        source.indexOf("requireProfile()"),
    );
  }
});

test("企画比較画面は出典URL・内部評価・APIキーを表示しない", async () => {
  const comparison = await readSource(
    "../src/app/dashboard/research/[reportId]/proposal/runs/[runId]/page.tsx",
  );
  assert.doesNotMatch(
    comparison,
    /source\.url|report\.sources|evidenceBasis|confidence|apiKey|engineVersion/,
  );
});
