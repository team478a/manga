import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cloudResearchFeatureEnabled,
  parseCloudResearchForm,
  parseCloudResearchRequestForm,
  runCloudMarketAnalysis,
} from "../src/lib/cloud-research.ts";

function validForm(overrides = {}) {
  const values = {
    genre: "女性向けファンタジー",
    audience: "20代〜30代のWeb漫画読者",
    platform: "電子書籍ストア",
    contentClass: "general",
    theme: "再出発と仕事",
    referenceWorks: "参考作品A、参考作品B",
    priceMin: "300",
    priceMax: "800",
    publicationFormat: "one_shot",
    pageCount: "48",
    sourceTitle0: "公式ランキング",
    sourceUrl0: "https://example.com/ranking",
    sourceRetrievedAt0: "2026-07-29T09:00",
    sourceFact0: "女性向けファンタジー作品が特集ページに掲載されている。",
    sourceType0: "platform",
    sourceTopics0: "demand",
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

test("市場分析は必須入力とHTTPS出典を検証する", () => {
  const input = parseCloudResearchForm(validForm());
  assert.equal(input.genre, "女性向けファンタジー");
  assert.equal(input.evidence.length, 1);
  assert.equal(input.evidence[0].url, "https://example.com/ranking");

  assert.throws(
    () =>
      parseCloudResearchForm(
        validForm({ sourceUrl0: "http://example.com/ranking" }),
      ),
    /HTTPS/,
  );
});

test("市場分析は不正な取得日時を安全にvalidation errorへ変換する", () => {
  assert.throws(
    () =>
      parseCloudResearchForm(
        validForm({ sourceRetrievedAt0: "not-a-date" }),
      ),
    /Invalid ISO datetime/,
  );
});

test("市場分析は価格逆転と重複出典を拒否する", () => {
  assert.throws(
    () => parseCloudResearchForm(validForm({ priceMin: "900", priceMax: "300" })),
    /下限を上限以下/,
  );
  assert.throws(
    () =>
      parseCloudResearchForm(
        validForm({
          sourceTitle1: "同じ公式ランキング",
          sourceUrl1: "https://example.com/ranking",
          sourceRetrievedAt1: "2026-07-29T09:10",
          sourceFact1: "同じURLから確認した別のメモ。",
          sourceType1: "platform",
          sourceTopics1: "demand",
        }),
      ),
    /重複/,
  );
});

test("市場分析は最大5件の出典を保持する", () => {
  const overrides = {};
  for (let index = 1; index < 5; index += 1) {
    overrides[`sourceTitle${index}`] = `公式情報${index + 1}`;
    overrides[`sourceUrl${index}`] = `https://example.com/source-${index + 1}`;
    overrides[`sourceRetrievedAt${index}`] = `2026-07-29T09:0${index}`;
    overrides[`sourceFact${index}`] = `確認した事実${index + 1}`;
    overrides[`sourceType${index}`] = "official";
    overrides[`sourceTopics${index}`] = "theme";
  }
  assert.equal(parseCloudResearchForm(validForm(overrides)).evidence.length, 5);
});

test("AI市場分析Formは選択値から制作条件を組み立て、出典入力を要求しない", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    genre: "ファンタジー",
    audience: "20代女性中心",
    platform: "Amazon Kindle",
    contentClass: "general",
    theme: "成長・再出発",
    referenceWorks: "",
    priceBand: "standard",
    publicationFormat: "series",
    pageCount: "32",
  }))
    form.set(key, value);
  const request = parseCloudResearchRequestForm(form);
  assert.equal(request.priceMin, 500);
  assert.equal(request.priceMax, 999);
  assert.equal(request.referenceWorks, "指定なし");
  assert.equal("evidence" in request, false);
});

test("AI市場分析Formは価格・形式・ページ数をAIに任せられる", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    genre: "恋愛",
    audience: "AIにおまかせ",
    platform: "AIにおまかせ",
    contentClass: "general",
    theme: "成長・再出発",
    referenceWorks: "",
    priceBand: "auto",
    publicationFormat: "auto",
    pageCount: "0",
  }))
    form.set(key, value);
  const request = parseCloudResearchRequestForm(form);
  assert.equal(request.priceMin, 0);
  assert.equal(request.priceMax, 0);
  assert.equal(request.publicationFormat, "auto");
  assert.equal(request.pageCount, 0);
});

test("市場分析Feature Flagは未設定時にfail closedする", () => {
  const previous = process.env.CLOUD_RESEARCH_MVP_ENABLED;
  delete process.env.CLOUD_RESEARCH_MVP_ENABLED;
  assert.equal(cloudResearchFeatureEnabled(), false);
  process.env.CLOUD_RESEARCH_MVP_ENABLED = "true";
  assert.equal(cloudResearchFeatureEnabled(), true);
  if (previous === undefined) delete process.env.CLOUD_RESEARCH_MVP_ENABLED;
  else process.env.CLOUD_RESEARCH_MVP_ENABLED = previous;
});

test("成人向け市場分析は既定で拒否し権限確認経路だけparseできる", () => {
  assert.throws(
    () => parseCloudResearchForm(validForm({ contentClass: "adult" })),
    /Desktop Adult/,
  );
  assert.equal(
    parseCloudResearchForm(validForm({ contentClass: "adult" }), {
      allowAdult: true,
    }).contentClass,
    "adult",
  );
});

test("市場分析結果は全項目を事実とAI推論に区分し出典を保持する", () => {
  const result = runCloudMarketAnalysis(
    parseCloudResearchForm(validForm()),
    "2026-07-29T00:00:00.000Z",
  );
  assert.equal(result.containsGeneratedMarketNumbers, false);
  assert.equal(result.engineVersion, "research-rules-v2");
  assert.equal(result.findings.length, 9);
  assert.deepEqual(
    result.findings.map((finding) => finding.key),
    [
      "market_demand",
      "competition",
      "reader_persona",
      "popular_themes",
      "differentiation",
      "price",
      "channels",
      "risks",
      "next_proposal",
    ],
  );
  for (const finding of result.findings) {
    assert.ok(["fact", "ai_inference"].includes(finding.classification));
    assert.ok(["source_fact", "user_input", "ai_inference"].includes(finding.evidenceBasis));
    assert.ok(["low", "medium", "high"].includes(finding.confidence));
  }
  assert.deepEqual(
    result.findings.find((finding) => finding.key === "market_demand").sourceUrls,
    ["https://example.com/ranking"],
  );
  assert.deepEqual(
    result.findings.find((finding) => finding.key === "price").sourceUrls,
    [],
  );
  assert.equal(result.quality.independentDomains, 1);
  assert.ok(result.quality.missingTopics.includes("competition"));
});

test("市場分析品質は独立ドメイン・鮮度・根拠分野の充足で向上する", () => {
  const overrides = {
    sourceTitle1: "業界調査",
    sourceUrl1: "https://research.example.org/report",
    sourceRetrievedAt1: "2026-07-29T09:00",
    sourceFact1: "競合作品の公開状況を確認した。",
    sourceType1: "industry_report",
    sourceTopics1: "competition",
    sourceTitle2: "公式規約",
    sourceUrl2: "https://platform.example.net/rules",
    sourceRetrievedAt2: "2026-07-29T09:00",
    sourceFact2: "販売チャネルの条件を確認した。",
    sourceType2: "official",
    sourceTopics2: "channel",
  };
  const single = runCloudMarketAnalysis(
    parseCloudResearchForm(validForm()),
    "2026-07-29T10:00:00.000Z",
  );
  const diverse = runCloudMarketAnalysis(
    parseCloudResearchForm(validForm(overrides)),
    "2026-07-29T10:00:00.000Z",
  );
  assert.ok(diverse.quality.score > single.quality.score);
  assert.equal(diverse.quality.independentDomains, 3);
});

test("市場分析UIは入力・履歴・再表示と完了後の企画導線を持つ", async () => {
  const files = await Promise.all(
    [
      "../src/app/dashboard/research/new/page.tsx",
      "../src/app/dashboard/research/page.tsx",
      "../src/app/dashboard/research/[reportId]/page.tsx",
      "../src/app/dashboard/research/[reportId]/proposal/page.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  assert.match(files[0], /priceBand/);
  assert.match(files[0], /市場、販売先、価格の知識は不要/);
  assert.match(files[0], /4ページ（短いお試し）/);
  assert.match(files[0], /8ページ（短編）/);
  assert.match(files[0], /AIにおまかせでは読切が32ページになる場合/);
  assert.doesNotMatch(files[0], /sourceRetrievedAt|sourceFact/);
  assert.match(files[1], /listCloudResearchReports/);
  assert.match(files[2], /市場分析結果/);
  assert.doesNotMatch(
    files[2],
    /engine_version|result\.quality|evidenceBasis|finding\.confidence/,
  );
  assert.match(files[2], /\/proposal/);
  assert.match(files[3], /ProposalSubmitButton/);
  assert.match(files[3], /cloudProposalFeatureEnabled/);
  for (const file of files.slice(2)) {
    assert.match(file, /ResourceNotFoundError/);
    assert.match(file, /notFound\(\)/);
    assert.ok(
      file.indexOf("cloudResearchFeatureEnabled()") <
        file.indexOf("getCloudResearchReport("),
      "詳細系RouteはDB照会前にFeature Flagを確認する",
    );
  }
});

test("市場分析migrationは所有者RLSとimmutableな保存範囲を持つ", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/202607290001_cloud_market_research.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /enable row level security/);
  assert.match(sql, /owner_profile_id = public\.current_profile_id\(\)/);
  assert.match(sql, /grant select, insert .* authenticated/);
  assert.doesNotMatch(sql, /grant .*update.*authenticated/i);
  assert.match(sql, /containsGeneratedMarketNumbers/);
});
