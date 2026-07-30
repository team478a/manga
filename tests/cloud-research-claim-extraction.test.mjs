import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractCloudResearchClaimCandidates } from "../src/lib/cloud-research-claim-extraction.ts";
import { enforceCloudResearchClaimExtractionRateLimit } from "../src/lib/cloud-research-search-rate-limit.ts";

function snapshot(text) {
  return {
    verification: {
      status: "verified",
      checkedAt: "2026-07-29T10:00:00.000Z",
      finalUrl: "https://official.example/report",
      contentType: "text/html",
      byteSize: 100,
      sha256: createHash("sha256").update(`raw:${text}`).digest("hex"),
    },
    text,
    textSha256: createHash("sha256").update(text).digest("hex"),
    textTruncated: false,
  };
}

test("選択分野の原文だけを根拠信号と位置付きで順位付けする", () => {
  const text = [
    "調査では電子コミック市場が2025年に前年比12%成長しました。",
    "作品の制作方法について説明します。",
    "市場の利用者は前年と比較して継続的に拡大しています。",
  ].join("\n");
  const result = extractCloudResearchClaimCandidates(
    snapshot(text),
    "demand",
    "2026-07-29T11:00:00.000Z",
  );
  assert.equal(result.extractedAt, "2026-07-29T11:00:00.000Z");
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].text.includes("12%成長"), true);
  assert.equal(result.candidates[0].signals.includes("市場"), true);
  assert.equal(result.candidates[0].signals.includes("成長"), true);
  assert.equal(
    text.slice(
      result.candidates[0].textStart,
      result.candidates[0].textEnd,
    ),
    result.candidates[0].text,
  );
  assert.equal(result.candidates[0].sourceSha256, snapshot(text).verification.sha256);
  assert.equal("text" in result, false);
});

test("boilerplateと無関係文を除外し候補を8件までに制限する", () => {
  const lines = [
    "プライバシーポリシーと市場利用規約をご確認ください。",
    "作者の近況を掲載しています。",
    ...Array.from(
      { length: 12 },
      (_, index) => `公式市場調査の需要項目${index + 1}では利用傾向を確認しています。`,
    ),
  ];
  const result = extractCloudResearchClaimCandidates(
    snapshot(lines.join("\n")),
    "demand",
  );
  assert.equal(result.candidates.length, 8);
  assert.equal(
    result.candidates.some((candidate) =>
      /プライバシー|作者の近況/.test(candidate.text),
    ),
    false,
  );
});

test("短い本文は事実候補抽出を拒否する", () => {
  assert.throws(
    () => extractCloudResearchClaimCandidates(snapshot("市場です。"), "demand"),
    (error) => error.code === "VALIDATION_ERROR",
  );
});

test("事実候補抽出rate limitは全体と利用者を取得前に制限する", async () => {
  const calls = [];
  await enforceCloudResearchClaimExtractionRateLimit("profile-1", {
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
      { scope: "user", limit: 20 },
    ],
  );
  assert.equal(calls.every(({ key }) => /^[0-9a-f]{64}$/.test(key)), true);
});

test("抽出ActionとUIは本文を返さず人の確認後にだけ事実欄へ採用する", async () => {
  const [action, client, page] = await Promise.all([
    readFile(
      new URL(
        "../src/app/dashboard/research/new/claim-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/research/new/claim-extractor.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/app/dashboard/research/new/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  const actionBody = action.slice(action.indexOf("export async function"));
  assert.match(action, /^"use server"/);
  assert.ok(
    actionBody.indexOf("requireProfile()") <
      actionBody.indexOf("enforceCloudResearchClaimExtractionRateLimit(profile.id)"),
  );
  assert.ok(
    actionBody.indexOf("enforceCloudResearchClaimExtractionRateLimit(profile.id)") <
      actionBody.indexOf("fetchCloudResearchSourceSnapshot(parsed.data.url)"),
  );
  assert.ok(
    actionBody.indexOf("fetchCloudResearchSourceSnapshot(parsed.data.url)") <
      actionBody.indexOf("extractCloudResearchClaimCandidates("),
  );
  assert.doesNotMatch(actionBody.slice(actionBody.indexOf("return {")), /text:\s*snapshot\.text/);
  assert.match(client, /候補です。採用前に必ず原文と照合してください/);
  assert.match(client, /type="button"/);
  assert.match(client, /document\.getElementById\("sourceFact0"\)/);
  assert.match(client, /事実メモへ採用/);
  assert.doesNotMatch(page, /<ClaimExtractor/);
});
