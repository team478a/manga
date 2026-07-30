import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cloudResearchSourceVerificationEnabled,
  configuredResearchSourceHosts,
  fetchCloudResearchSourceSnapshot,
  isPublicResearchAddress,
  verifyCloudResearchSource,
  verifyCloudResearchSources,
} from "../src/lib/cloud-research-source-verification.ts";
import { parseCloudResearchForm } from "../src/lib/cloud-research.ts";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

function response(body, init = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
}

function researchInput() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    genre: "ファンタジー",
    audience: "Web漫画読者",
    platform: "電子書籍",
    contentClass: "general",
    theme: "再出発",
    referenceWorks: "参考作品",
    priceMin: "300",
    priceMax: "800",
    publicationFormat: "one_shot",
    pageCount: "32",
    sourceTitle0: "公式",
    sourceUrl0: "https://official.example/report",
    sourceRetrievedAt0: "2026-07-29T09:00",
    sourceFact0: "公式情報を確認した。",
    sourceType0: "official",
    sourceTopics0: "demand",
  })) {
    form.set(key, value);
  }
  return parseCloudResearchForm(form);
}

test("出典検証Feature Flagと許可hostは未設定時fail closed", () => {
  const previousFlag = process.env.CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED;
  const previousHosts = process.env.CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS;
  delete process.env.CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED;
  delete process.env.CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS;
  assert.equal(cloudResearchSourceVerificationEnabled(), false);
  assert.deepEqual(configuredResearchSourceHosts(), []);
  process.env.CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED = "true";
  process.env.CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS =
    " Official.Example,official.example ";
  assert.equal(cloudResearchSourceVerificationEnabled(), true);
  assert.deepEqual(configuredResearchSourceHosts(), ["official.example"]);
  if (previousFlag === undefined)
    delete process.env.CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED;
  else process.env.CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED = previousFlag;
  if (previousHosts === undefined)
    delete process.env.CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS;
  else process.env.CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS = previousHosts;
});

test("出典検証はpublic addressだけを許可する", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.1.1",
    "172.16.0.1",
    "192.0.2.1",
    "192.168.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(isPublicResearchAddress(address), false, address);
  assert.equal(isPublicResearchAddress("93.184.216.34"), true);
  assert.equal(isPublicResearchAddress("2606:2800:220:1:248:1893:25c8:1946"), true);
});

test("許可済みHTTPS出典から検証metadataとhashだけを作る", async () => {
  const html = "<html><head><title> 公式 市場レポート </title></head><body>本文</body></html>";
  const result = await verifyCloudResearchSource(
    "https://official.example/report",
    {
      allowedHosts: ["official.example"],
      lookup: publicLookup,
      fetcher: async () => response(html),
      now: () => new Date("2026-07-29T10:00:00.000Z"),
    },
  );
  assert.equal(result.status, "verified");
  assert.equal(result.documentTitle, "公式 市場レポート");
  assert.equal(
    result.sha256,
    createHash("sha256").update(new TextEncoder().encode(html)).digest("hex"),
  );
  assert.equal(result.checkedAt, "2026-07-29T10:00:00.000Z");
  assert.equal("body" in result, false);
});

test("snapshotはHTMLのnoiseを除去し本文位置用hashを作る", async () => {
  const html = `
    <html><head><title>市場 &amp; 読者</title><script>秘密の市場数値</script></head>
    <body><header>共通メニュー</header><main>
      <h1>電子コミック市場</h1>
      <p>女性読者の利用動向を公式調査で確認できます。</p>
      <p>女性読者の利用動向を公式調査で確認できます。</p>
    </main><footer>利用規約</footer></body></html>`;
  const snapshot = await fetchCloudResearchSourceSnapshot(
    "https://official.example/report",
    {
      allowedHosts: ["official.example"],
      lookup: publicLookup,
      fetcher: async () => response(html),
    },
  );
  assert.equal(snapshot.verification.documentTitle, "市場 & 読者");
  assert.match(snapshot.text, /電子コミック市場/);
  assert.match(snapshot.text, /女性読者の利用動向/);
  assert.doesNotMatch(snapshot.text, /秘密の市場数値|共通メニュー|利用規約/);
  assert.equal(
    snapshot.text.split("女性読者の利用動向").length - 1,
    1,
  );
  assert.equal(
    snapshot.textSha256,
    createHash("sha256").update(snapshot.text, "utf8").digest("hex"),
  );
  assert.equal(snapshot.textTruncated, false);
  assert.equal("bytes" in snapshot, false);
});

test("snapshotはplain textとJSONのscalar値を正規化する", async () => {
  const common = {
    allowedHosts: ["official.example"],
    lookup: publicLookup,
  };
  const plain = await fetchCloudResearchSourceSnapshot(
    "https://official.example/plain",
    {
      ...common,
      fetcher: async () =>
        new Response(" 市場  需要 \r\n 価格は500円 ", {
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
    },
  );
  assert.equal(plain.text, "市場 需要\n価格は500円");

  const json = await fetchCloudResearchSourceSnapshot(
    "https://official.example/data",
    {
      ...common,
      fetcher: async () =>
        new Response(
          JSON.stringify({ report: { demand: "市場は成長", price: 500 } }),
          { headers: { "content-type": "application/json" } },
        ),
    },
  );
  assert.match(json.text, /report\ndemand\n市場は成長\nprice\n500/);
});

test("未許可host・IP literal・private DNSをfetch前に拒否する", async () => {
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls += 1;
    return response("unused");
  };
  await assert.rejects(
    verifyCloudResearchSource("https://other.example/report", {
      allowedHosts: ["official.example"],
      lookup: publicLookup,
      fetcher,
    }),
    (error) => error.code === "VALIDATION_ERROR",
  );
  await assert.rejects(
    verifyCloudResearchSource("https://127.0.0.1/report", {
      allowedHosts: ["127.0.0.1"],
      lookup: publicLookup,
      fetcher,
    }),
    (error) => error.code === "VALIDATION_ERROR",
  );
  await assert.rejects(
    verifyCloudResearchSource("https://official.example/report", {
      allowedHosts: ["official.example"],
      lookup: async () => [{ address: "10.0.0.5", family: 4 }],
      fetcher,
    }),
    (error) => error.code === "VALIDATION_ERROR",
  );
  assert.equal(fetchCalls, 0);
});

test("redirect先も許可hostとpublic DNSを再検証する", async () => {
  const visited = [];
  const result = await verifyCloudResearchSource(
    "https://official.example/start",
    {
      allowedHosts: ["official.example", "report.example"],
      lookup: async (hostname) => {
        visited.push(`dns:${hostname}`);
        return publicLookup();
      },
      fetcher: async (url) => {
        visited.push(`fetch:${url.hostname}`);
        return url.hostname === "official.example"
          ? new Response(null, {
              status: 302,
              headers: { location: "https://report.example/final" },
            })
          : response("verified");
      },
    },
  );
  assert.equal(result.finalUrl, "https://report.example/final");
  assert.deepEqual(visited, [
    "dns:official.example",
    "fetch:official.example",
    "dns:report.example",
    "fetch:report.example",
  ]);

  await assert.rejects(
    verifyCloudResearchSource("https://official.example/start", {
      allowedHosts: ["official.example"],
      lookup: publicLookup,
      fetcher: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://private.example/final" },
        }),
    }),
    (error) => error.code === "VALIDATION_ERROR",
  );
});

test("非対応MIME・1MB超・timeoutを用途別に拒否する", async () => {
  const base = {
    allowedHosts: ["official.example"],
    lookup: publicLookup,
  };
  await assert.rejects(
    verifyCloudResearchSource("https://official.example/file", {
      ...base,
      fetcher: async () =>
        new Response("pdf", {
          headers: { "content-type": "application/pdf" },
        }),
    }),
    (error) => error.code === "VALIDATION_ERROR",
  );
  await assert.rejects(
    verifyCloudResearchSource("https://official.example/large", {
      ...base,
      fetcher: async () =>
        new Response(new Uint8Array(1_000_001), {
          headers: { "content-type": "text/plain" },
        }),
    }),
    (error) => error.code === "PAYLOAD_TOO_LARGE",
  );
  await assert.rejects(
    verifyCloudResearchSource("https://official.example/slow", {
      ...base,
      fetcher: async () => {
        throw new DOMException("timeout", "TimeoutError");
      },
    }),
    (error) => error.code === "PROVIDER_TIMEOUT",
  );
});

test("複数出典検証は入力本文を変えずverificationだけを追加する", async () => {
  const input = researchInput();
  const verified = await verifyCloudResearchSources(input, {
    allowedHosts: ["official.example"],
    lookup: publicLookup,
    fetcher: async () => response("verified"),
    now: () => new Date("2026-07-29T10:00:00.000Z"),
  });
  assert.equal(verified.evidence[0].fact, input.evidence[0].fact);
  assert.equal(verified.evidence[0].verification.status, "verified");
  assert.equal(input.evidence[0].verification, undefined);
});

test("保存ActionはAIが確認した出典付き結果だけを永続化する", async () => {
  const source = await readFile(
    new URL("../src/app/dashboard/research/actions.ts", import.meta.url),
    "utf8",
  );
  const analyzeAt = source.indexOf("await analyze({");
  const persistAt = source.indexOf("createCloudResearchReport({");
  assert.doesNotMatch(source, /maybeVerifyCloudResearchSources/);
  assert.ok(analyzeAt >= 0);
  assert.ok(analyzeAt < persistAt);
});
