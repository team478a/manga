import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BraveCloudResearchSearchProvider,
  cloudResearchSearchEnabled,
  cloudResearchSearchInputSchema,
  parseCloudResearchSearchAdoption,
} from "../src/lib/cloud-research-search.ts";
import { enforceCloudResearchSearchRateLimit } from "../src/lib/cloud-research-search-rate-limit.ts";

function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const validInput = {
  query: "日本 電子コミック 市場",
  topic: "demand",
  freshness: "year",
};

test("検索Feature Flagは未設定時fail closed", () => {
  const previous = process.env.CLOUD_RESEARCH_SEARCH_ENABLED;
  delete process.env.CLOUD_RESEARCH_SEARCH_ENABLED;
  assert.equal(cloudResearchSearchEnabled(), false);
  process.env.CLOUD_RESEARCH_SEARCH_ENABLED = "true";
  assert.equal(cloudResearchSearchEnabled(), true);
  if (previous === undefined) delete process.env.CLOUD_RESEARCH_SEARCH_ENABLED;
  else process.env.CLOUD_RESEARCH_SEARCH_ENABLED = previous;
});

test("検索条件は400文字・50語・根拠分野・鮮度を検証する", () => {
  assert.equal(cloudResearchSearchInputSchema.safeParse(validInput).success, true);
  assert.equal(
    cloudResearchSearchInputSchema.safeParse({
      ...validInput,
      query: Array.from({ length: 51 }, (_, index) => `word${index}`).join(" "),
    }).success,
    false,
  );
  assert.equal(
    cloudResearchSearchInputSchema.safeParse({
      ...validInput,
      topic: "unknown",
    }).success,
    false,
  );
});

test("Brave adapterは日本向けstrict検索を行い候補を安全に正規化する", async () => {
  const previousHosts = process.env.CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS;
  process.env.CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS = "official.example";
  let requestedUrl;
  let requestedInit;
  const provider = new BraveCloudResearchSearchProvider({
    apiKey: "server-secret",
    fetcher: async (url, init) => {
      requestedUrl = new URL(url);
      requestedInit = init;
      return jsonResponse({
        web: {
          results: [
            {
              title: " 公式   市場資料 ",
              url: "https://official.example/report#section",
              description: " 市場に関する   検索snippet ",
              page_age: "2026-07-01T00:00:00Z",
            },
            {
              title: "重複",
              url: "https://official.example/report",
            },
            { title: "HTTP", url: "http://unsafe.example/report" },
            { title: "IP", url: "https://127.0.0.1/report" },
            {
              title: "候補",
              url: "https://candidate.example/report",
            },
          ],
        },
      });
    },
    now: () => new Date("2026-07-29T10:00:00.000Z"),
  });
  const result = await provider.search(validInput);

  assert.equal(requestedUrl.hostname, "api.search.brave.com");
  assert.equal(requestedUrl.searchParams.get("country"), "JP");
  assert.equal(requestedUrl.searchParams.get("search_lang"), "ja");
  assert.equal(requestedUrl.searchParams.get("safesearch"), "strict");
  assert.equal(requestedUrl.searchParams.get("freshness"), "py");
  assert.equal(requestedInit.headers["x-subscription-token"], "server-secret");
  assert.equal(result.searchedAt, "2026-07-29T10:00:00.000Z");
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.candidates[0], {
    title: "公式 市場資料",
    url: "https://official.example/report",
    description: "市場に関する 検索snippet",
    publishedAt: "2026-07-01T00:00:00.000Z",
    verificationEligible: true,
  });
  assert.equal(result.candidates[1].verificationEligible, false);
  assert.equal(JSON.stringify(result).includes("server-secret"), false);

  if (previousHosts === undefined)
    delete process.env.CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS;
  else process.env.CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS = previousHosts;
});

test("検索Providerのrate limit・timeout・容量超過・不正schemaを分類する", async () => {
  const provider = (fetcher) =>
    new BraveCloudResearchSearchProvider({
      apiKey: "secret",
      fetcher,
    });
  await assert.rejects(
    provider(async () => new Response(null, { status: 429 })).search(validInput),
    (error) => error.code === "RATE_LIMITED",
  );
  await assert.rejects(
    provider(async () => {
      throw new DOMException("timeout", "TimeoutError");
    }).search(validInput),
    (error) => error.code === "PROVIDER_TIMEOUT",
  );
  await assert.rejects(
    provider(async () =>
      new Response(new Uint8Array(512 * 1024 + 1), {
        headers: { "content-type": "application/json" },
      }),
    ).search(validInput),
    (error) => error.code === "PAYLOAD_TOO_LARGE",
  );
  await assert.rejects(
    provider(async () => jsonResponse({ web: { results: "invalid" } })).search(
      validInput,
    ),
    (error) => error.code === "PROVIDER_UNAVAILABLE",
  );
});

test("候補採用値はHTTPS URLと構造化分野を再検証する", () => {
  assert.deepEqual(
    parseCloudResearchSearchAdoption({
      title: "公式資料",
      url: "https://official.example/report#part",
      topic: "price",
      publishedAt: "2026-07-01T00:00:00.000Z",
    }),
    {
      title: "公式資料",
      url: "https://official.example/report",
      topic: "price",
      publishedAt: "2026-07-01T00:00:00.000Z",
    },
  );
  assert.equal(
    parseCloudResearchSearchAdoption({
      title: "危険",
      url: "http://unsafe.example",
      topic: "price",
    }),
    undefined,
  );
});

test("検索rate limitは全体と利用者をProvider呼出前に制限する", async () => {
  const calls = [];
  await enforceCloudResearchSearchRateLimit("profile-1", {
    secret: "a".repeat(32),
    consume: async (scope, key, limit) => {
      calls.push({ scope, key, limit });
      return true;
    },
  });
  assert.deepEqual(
    calls.map(({ scope, limit }) => ({ scope, limit })),
    [
      { scope: "global", limit: 300 },
      { scope: "user", limit: 10 },
    ],
  );
  assert.equal(calls.every(({ key }) => /^[0-9a-f]{64}$/.test(key)), true);
  await assert.rejects(
    enforceCloudResearchSearchRateLimit("profile-1", {
      secret: "a".repeat(32),
      consume: async () => false,
    }),
    (error) => error.code === "RATE_LIMITED",
  );
  await assert.rejects(
    enforceCloudResearchSearchRateLimit("profile-1", {
      secret: "short",
      consume: async () => true,
    }),
    (error) => error.code === "PROVIDER_UNAVAILABLE",
  );
});

test("検索UIはPOST Actionを使いsnippetを事実へ自動転記しない", async () => {
  const [action, client, page, researchForm] = await Promise.all([
    readFile(
      new URL(
        "../src/app/dashboard/research/discover/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/research/discover/source-discovery-form.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/research/discover/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/app/dashboard/research/new/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(action, /^"use server"/);
  assert.ok(
    action.indexOf("requireProfile()") <
      action.indexOf("configuredCloudResearchSearchProvider()"),
  );
  assert.ok(
    action.indexOf("enforceCloudResearchSearchRateLimit(profile.id)") <
      action.indexOf("provider.search(parsed.data)"),
  );
  assert.match(client, /useActionState/);
  assert.match(client, /検索snippet（未確認）/);
  assert.match(client, /原文を確認/);
  assert.match(client, /Feature Flag/);
  assert.match(page, /cloudResearchSearchEnabled/);
  assert.match(researchForm, /AI市場分析/);
  assert.doesNotMatch(researchForm, /adoptedCandidate|sourceFact/);
});
