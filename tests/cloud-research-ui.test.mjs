import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("市場分析Formはlabel・補足説明・動的messageを支援技術へ公開する", async () => {
  const [form, report] = await Promise.all([
    readSource("../src/app/dashboard/research/new/page.tsx"),
    readSource("../src/app/dashboard/research/[reportId]/page.tsx"),
  ]);
  assert.match(form, /<label className="label" htmlFor=\{id\}>/);
  assert.match(form, /role="alert"/);
  assert.match(form, /role="status"/);
  assert.match(form, /出典URLや確認事実の手入力は不要/);
  assert.match(form, /<select className="field"/);
  assert.doesNotMatch(form, /sourceType|sourceTopics|sourceFact/);
  assert.match(report, /aria-live="polite"/);
  assert.match(report, /role="status"/);
});

test("市場分析画面とShellは390px向けの可変layout契約を維持する", async () => {
  const sources = await Promise.all([
    readSource("../src/app/dashboard/research/new/page.tsx"),
    readSource("../src/app/dashboard/research/page.tsx"),
    readSource("../src/app/dashboard/research/[reportId]/page.tsx"),
    readSource("../src/components/CloudWorkflowShell.tsx"),
  ]);
  assert.match(sources[0], /sm:grid-cols-2/);
  assert.match(sources[1], /sm:flex-row/);
  assert.match(sources[2], /lg:grid-cols-2/);
  assert.match(sources[3], /lg:grid-cols-\[216px_minmax\(0,1fr\)\]/);
  assert.match(sources[3], /overflow-x-auto/);
  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /(?:min-|max-)?w-\[[4-9]\d{2,}px\]/,
      "mobile幅を超える固定widthを追加しない",
    );
  }
  assert.match(sources[2], /break-words/);
  assert.match(sources[3], /<div className="min-w-0">/);
});

test("市場分析の主要操作はbuttonまたはlinkとして実装される", async () => {
  const [form, history, report] = await Promise.all([
    readSource("../src/app/dashboard/research/new/page.tsx"),
    readSource("../src/app/dashboard/research/page.tsx"),
    readSource("../src/app/dashboard/research/[reportId]/page.tsx"),
  ]);
  assert.match(form, /<ResearchSubmitButton \/>/);
  assert.match(history, /<Link[\s\S]*新しい市場分析/);
  assert.match(report, /<Link[\s\S]*AI企画提案の準備へ/);
  assert.doesNotMatch(
    `${form}\n${history}\n${report}`,
    /<div[^>]*onClick=/,
  );
});

test("利用者画面は内部分析ロジックと参照情報を隠し結果だけを表示する", async () => {
  const [report, extractor, comparison] = await Promise.all([
    readSource("../src/app/dashboard/research/[reportId]/page.tsx"),
    readSource(
      "../src/app/dashboard/research/new/claim-extractor.tsx",
    ),
    readSource(
      "../src/app/dashboard/research/new/claim-comparison.tsx",
    ),
  ]);

  assert.match(report, /市場分析結果/);
  assert.match(report, /finding\.summary/);
  assert.doesNotMatch(
    report,
    /engine_version|result\.quality|evidenceBasis|finding\.confidence|finding\.limitations|report\.sources|source\.url|source\.retrievedAt|参照情報|verification\.contentType|verification\.sha256/,
  );
  assert.doesNotMatch(
    extractor,
    /candidate\.signals|candidate\.textStart|candidate\.textEnd|state\.textSha256/,
  );
  assert.doesNotMatch(
    comparison,
    /comparison\.reason|comparison\.sharedMetrics|comparison\.sharedYears|comparison\.confidence/,
  );
});

test("市場分析RouteはFeature Flag停止時に認証・DBより先にfail closedする", async () => {
  const sources = await Promise.all(
    [
      "../src/app/dashboard/page.tsx",
      "../src/app/dashboard/research/page.tsx",
      "../src/app/dashboard/research/new/page.tsx",
      "../src/app/dashboard/research/discover/page.tsx",
      "../src/app/dashboard/research/[reportId]/page.tsx",
      "../src/app/dashboard/research/[reportId]/proposal/page.tsx",
      "../src/app/dashboard/research/actions.ts",
      "../src/app/dashboard/research/discover/actions.ts",
      "../src/app/dashboard/research/new/claim-actions.ts",
      "../src/app/dashboard/research/new/corroboration-actions.ts",
    ].map(readSource),
  );

  for (const source of sources) {
    assert.ok(
      source.indexOf("cloudResearchFeatureEnabled()") <
        source.indexOf("requireProfile()"),
      "Feature Flagを認証・市場分析DB処理より先に確認する",
    );
  }
});

test("AI市場分析は利用者へ出典入力を要求せずProvider未設定を安全に案内する", async () => {
  const [form, discovery, verification] = await Promise.all([
    readSource("../src/app/dashboard/research/new/page.tsx"),
    readSource("../src/app/dashboard/research/discover/page.tsx"),
    readSource("../src/lib/cloud-research-source-verification.ts"),
  ]);

  assert.match(form, /出典URLや確認事実の手入力は不要/);
  assert.doesNotMatch(form, /手動入力して市場分析を続けられます/);
  assert.match(discovery, /市場分析入力画面で出典を手動入力できます/);
  assert.doesNotMatch(form, /Server取得検証は現在無効です/);
  assert.match(verification, /cloudResearchSourceVerificationEnabled\(\)[\s\S]*verifyCloudResearchSources\(input\)[\s\S]*: input/);
});

test("市場分析はloading・empty・error・not found状態を持つ", async () => {
  const [loading, history, error, notFound] = await Promise.all([
    readSource("../src/app/dashboard/research/loading.tsx"),
    readSource("../src/app/dashboard/research/page.tsx"),
    readSource("../src/app/dashboard/research/error.tsx"),
    readSource("../src/app/dashboard/research/not-found.tsx"),
  ]);

  assert.match(loading, /aria-busy="true"/);
  assert.match(history, /保存済みReportはありません/);
  assert.match(error, /市場分析を表示できませんでした/);
  assert.match(error, /内部情報は表示していません/);
  assert.doesNotMatch(error, /error\.message|error\.stack|error\.digest/);
  assert.match(notFound, /市場分析レポートが見つかりません/);
  assert.match(notFound, /表示権限がない可能性/);
});

test("市場分析の390px・768px・1280px構造に画面幅を超える固定幅がない", async () => {
  const files = [
    "../src/app/dashboard/page.tsx",
    "../src/app/dashboard/research/page.tsx",
    "../src/app/dashboard/research/new/page.tsx",
    "../src/app/dashboard/research/discover/page.tsx",
    "../src/app/dashboard/research/discover/source-discovery-form.tsx",
    "../src/app/dashboard/research/[reportId]/page.tsx",
    "../src/app/dashboard/research/[reportId]/proposal/page.tsx",
    "../src/app/dashboard/research/loading.tsx",
    "../src/app/dashboard/research/error.tsx",
    "../src/app/dashboard/research/not-found.tsx",
    "../src/components/CloudWorkflowShell.tsx",
  ];
  const sources = await Promise.all(files.map(readSource));

  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(
      source,
      /(?:min-|max-)?w-\[(?:39[1-9]|[4-9]\d{2,}|\d{4,})px\]/,
      `${files[index]}に390px viewportを超える固定幅を追加しない`,
    );
  }
  assert.match(sources[0], /sm:flex-row/);
  assert.match(sources[2], /sm:grid-cols-2/);
  assert.match(sources[5], /lg:grid-cols-2/);
  assert.match(
    sources.at(-1),
    /lg:grid-cols-\[216px_minmax\(0,1fr\)\]/,
  );
});
