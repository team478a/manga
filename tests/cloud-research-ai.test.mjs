import assert from "node:assert/strict";
import test from "node:test";
import { runCloudResearchAiAnalysis } from "../src/lib/cloud-research-ai.ts";

const request = {
  genre: "ファンタジー",
  audience: "20代女性中心",
  platform: "Amazon Kindle",
  contentClass: "general",
  theme: "成長・再出発",
  referenceWorks: "指定なし",
  priceMin: 500,
  priceMax: 999,
  publicationFormat: "series",
  pageCount: 32,
};

const output = {
  market_demand: "公開情報を踏まえると、読者需要を検証する余地があります。",
  competition: "近い訴求の作品との差別化が必要です。",
  reader_persona: "スマートフォンで電子漫画を読む20代女性を中心に想定します。",
  popular_themes: "成長と再出発を関係性の変化と組み合わせます。",
  differentiation: "主人公の職業と選択の代償を独自軸にします。",
  price: "指定価格帯とページ数の整合を販売画面で再確認します。",
  channels: "主チャネルの規約と導線を確認します。",
  risks: "類似表現、規約、根拠の鮮度を確認します。",
  next_proposal: "読者、テーマ、差別化軸を企画条件へ引き継ぎます。",
};

test("AI市場分析はWeb出典を保存し構造化された9項目だけを返す", async () => {
  let requestBody;
  const fetchImplementation = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify(output),
                annotations: [
                  {
                    type: "url_citation",
                    url: "https://example.com/official",
                    title: "公式情報",
                  },
                  {
                    type: "url_citation",
                    url: "https://example.org/report",
                    title: "調査情報",
                  },
                ],
              },
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const analysis = await runCloudResearchAiAnalysis({
    profileId: "46f3ad2e-3b9a-4aef-94ee-188978be9cf0",
    request,
    fetchImplementation,
    runtimeConfig: { apiKey: "sk-test-00000000000000000000", model: "gpt-5.6-terra" },
    now: "2026-07-30T00:00:00.000Z",
  });
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.tools[0].type, "web_search");
  assert.ok(!JSON.stringify(requestBody).includes("sk-test"));
  assert.equal(analysis.input.evidence.length, 2);
  assert.equal(analysis.result.engineVersion, "openai-web-research-v1");
  assert.equal(analysis.result.findings.length, 9);
  assert.equal(analysis.result.containsGeneratedMarketNumbers, false);
});

test("成人向け入力はProvider設定を読む前に拒否する", async () => {
  await assert.rejects(
    runCloudResearchAiAnalysis({
      profileId: "46f3ad2e-3b9a-4aef-94ee-188978be9cf0",
      request: { ...request, contentClass: "adult" },
      runtimeConfig: { apiKey: "sk-test-00000000000000000000", model: "gpt-5.6-terra" },
    }),
    /外部AIへ送信しません/,
  );
});

test("引用がないProvider応答は保存せず安全に失敗する", async () => {
  await assert.rejects(
    runCloudResearchAiAnalysis({
      profileId: "46f3ad2e-3b9a-4aef-94ee-188978be9cf0",
      request,
      fetchImplementation: async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify(output),
            output: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      runtimeConfig: { apiKey: "sk-test-00000000000000000000", model: "gpt-5.6-terra" },
    }),
    /根拠を確認できる分析結果/,
  );
});
