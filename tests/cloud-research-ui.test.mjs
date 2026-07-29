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
  assert.match(form, /id="research-evidence-help"/);
  assert.match(form, /aria-describedby="research-evidence-help"/);
  assert.match(form, /sourceType/);
  assert.match(form, /sourceTopics/);
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
});

test("市場分析の主要操作はbuttonまたはlinkとして実装される", async () => {
  const [form, history, report] = await Promise.all([
    readSource("../src/app/dashboard/research/new/page.tsx"),
    readSource("../src/app/dashboard/research/page.tsx"),
    readSource("../src/app/dashboard/research/[reportId]/page.tsx"),
  ]);
  assert.match(form, /<button[\s\S]*type="submit"/);
  assert.match(history, /<Link[\s\S]*新しい市場分析/);
  assert.match(report, /<Link[\s\S]*AI企画提案の準備へ/);
  assert.doesNotMatch(
    `${form}\n${history}\n${report}`,
    /<div[^>]*onClick=/,
  );
});

test("利用者画面は内部分析ロジックを隠し結果と参照情報だけを表示する", async () => {
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
  assert.match(report, /参照情報/);
  assert.match(report, /finding\.summary/);
  assert.match(report, /source\.url/);
  assert.match(report, /source\.retrievedAt/);
  assert.doesNotMatch(
    report,
    /engine_version|result\.quality|evidenceBasis|finding\.confidence|finding\.limitations|verification\.contentType|verification\.sha256/,
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
