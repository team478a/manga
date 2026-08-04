import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateResearchReport } from "../src/modules/research/application/generate-report.ts";
import { discoverResearchSources } from "../src/modules/research/application/discover-sources.ts";
import { researchActionError } from "../src/modules/research/presentation/research-actions.ts";

const profileId = "10000000-0000-4000-8000-000000000001";
const request = {
  genre: "ファンタジー",
  audience: "AIにおまかせ",
  platform: "AIにおまかせ",
  contentClass: "general",
  theme: "成長",
  referenceWorks: "指定なし",
  priceMin: 0,
  priceMax: 0,
  publicationFormat: "auto",
  pageCount: 0,
};

function dependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    value: {
      featureEnabled: () => true,
      async enforceRateLimit(id) {
        calls.push(["rate", id]);
      },
      async getMonitorAllowance(id) {
        calls.push(["allowance", id]);
        return { used: 0, limit: 10 };
      },
      async analyze(input) {
        calls.push(["analyze", input.profileId]);
        return {
          input: { ...input.request, evidence: [] },
          result: {
            generatedAt: "2026-08-05T00:00:00.000Z",
            engineVersion: "test",
            findings: [],
            quality: {},
            containsGeneratedMarketNumbers: false,
          },
        };
      },
      async consumeAllowance(id) {
        calls.push(["consume", id]);
      },
      async save(input) {
        calls.push(["save", input.profileId]);
        return "20000000-0000-4000-8000-000000000001";
      },
      ...overrides,
    },
  };
}

test("市場分析applicationはrate・権限・分析・消費・保存を順番に実行する", async () => {
  const setup = dependencies();
  const reportId = await generateResearchReport(
    { profileId, request },
    setup.value,
  );
  assert.equal(reportId, "20000000-0000-4000-8000-000000000001");
  assert.deepEqual(setup.calls.map(([name]) => name), [
    "rate",
    "allowance",
    "analyze",
    "consume",
    "save",
  ]);
});

test("停止・成人向け・上限超過はProvider呼び出し前にfail closedする", async () => {
  for (const [customRequest, overrides, code] of [
    [request, { featureEnabled: () => false }, "PERMISSION_DENIED"],
    [{ ...request, contentClass: "adult" }, {}, "PERMISSION_DENIED"],
    [request, { getMonitorAllowance: async () => ({ used: 10, limit: 10 }) }, "QUOTA_EXCEEDED"],
  ]) {
    let analyzed = false;
    const setup = dependencies({
      ...overrides,
      async analyze() {
        analyzed = true;
        throw new Error("must not run");
      },
    });
    await assert.rejects(
      generateResearchReport(
        { profileId, request: customRequest },
        setup.value,
      ),
      (error) => error.code === code,
    );
    assert.equal(analyzed, false);
  }
});

test("Provider障害時は利用枠消費と保存へ進まず内部詳細を表示しない", async () => {
  const setup = dependencies({
    async analyze() {
      throw new Error("provider-private-detail");
    },
  });
  await assert.rejects(
    generateResearchReport({ profileId, request }, setup.value),
    /provider-private-detail/,
  );
  assert.equal(setup.calls.some(([name]) => name === "consume"), false);
  assert.equal(setup.calls.some(([name]) => name === "save"), false);
  assert.equal(
    researchActionError(
      new Error("provider-private-detail"),
      "市場分析を完了できませんでした。",
    ),
    "市場分析を完了できませんでした。",
  );
});

test("検索applicationはprofile単位rate limit後にadapterへ委譲する", async () => {
  const order = [];
  const search = { query: "漫画 市場", topic: "demand", freshness: "month" };
  const result = await discoverResearchSources(
    { profileId, search },
    {
      async enforceRateLimit(id) {
        order.push(["rate", id]);
      },
      provider: {
        providerId: "brave-web-search",
        async search(input) {
          order.push(["search", input.query]);
          return {
            provider: "brave-web-search",
            searchedAt: "2026-08-05T00:00:00.000Z",
            topic: input.topic,
            candidates: [],
          };
        },
      },
    },
  );
  assert.equal(result.provider, "brave-web-search");
  assert.deepEqual(order, [
    ["rate", profileId],
    ["search", "漫画 市場"],
  ]);
});

test("旧research entrypointはmoduleへの互換adapterだけを公開する", async () => {
  for (const file of [
    "cloud-research.ts",
    "cloud-research-ai.ts",
    "cloud-research-claim-extraction.ts",
    "cloud-research-corroboration.ts",
    "cloud-research-evaluation.ts",
    "cloud-research-persistence.ts",
    "cloud-research-search.ts",
    "cloud-research-server.ts",
    "cloud-research-source-verification.ts",
  ]) {
    const source = await readFile(new URL(`../src/lib/${file}`, import.meta.url), "utf8");
    assert.match(source, /modules\/research\//);
    assert.doesNotMatch(source, /createAdminClient|\.from\(|fetch\(/);
  }
});
