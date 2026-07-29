import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compareCloudResearchClaimCandidates } from "../src/lib/cloud-research-corroboration.ts";

const goldenSet = JSON.parse(
  await readFile(
    new URL(
      "./fixtures/cloud-research-corroboration-golden.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function extraction(text, signals, sourceIndex, hostname) {
  const sourceHash = createHash("sha256")
    .update(`${sourceIndex}:${text}`)
    .digest("hex");
  return {
    sourceVerification: {
      status: "verified",
      checkedAt: "2026-07-29T10:00:00.000Z",
      finalUrl: `https://${hostname}/report-${sourceIndex}`,
      contentType: "text/html",
      byteSize: 100,
      sha256: sourceHash,
    },
    extractedAt: "2026-07-29T10:01:00.000Z",
    textSha256: createHash("sha256").update(text).digest("hex"),
    textTruncated: false,
    candidates: [
      {
        id: `claim-${sourceIndex}`,
        text,
        topic: "demand",
        score: 20,
        signals,
        textStart: 0,
        textEnd: text.length,
        sourceSha256: sourceHash,
        textSha256: createHash("sha256").update(text).digest("hex"),
      },
    ],
  };
}

test("golden setを保守的な期待分類で判定する", () => {
  for (const fixture of goldenSet) {
    const result = compareCloudResearchClaimCandidates(
      extraction(
        fixture.primary,
        fixture.primarySignals,
        1,
        "primary.example",
      ),
      extraction(
        fixture.comparison,
        fixture.comparisonSignals,
        2,
        "comparison.example",
      ),
      "2026-07-29T11:00:00.000Z",
    );
    const actual = result.comparisons[0]?.relation ?? "insufficient";
    assert.equal(actual, fixture.expected, fixture.name);
    assert.equal(result.comparedAt, "2026-07-29T11:00:00.000Z");
    assert.equal(result.independentDomains, true);
    assert.equal("text" in result, false);
  }
});

test("同一domainは独立した裏付けとして扱わず比較結果を6件に制限する", () => {
  const primary = extraction(
    "電子コミック市場規模は2025年に100億円でした。",
    ["市場", "規模"],
    1,
    "same.example",
  );
  primary.candidates = Array.from({ length: 8 }, (_, index) => ({
    ...primary.candidates[0],
    id: `primary-${index}`,
  }));
  const comparison = extraction(
    "電子コミック市場規模は2025年に100億円です。",
    ["市場", "規模"],
    2,
    "same.example",
  );
  comparison.candidates = Array.from({ length: 8 }, (_, index) => ({
    ...comparison.candidates[0],
    id: `comparison-${index}`,
  }));
  const result = compareCloudResearchClaimCandidates(primary, comparison);
  assert.equal(result.independentDomains, false);
  assert.equal(result.comparisons.length, 6);
  assert.equal(
    result.comparisons.every((item) => item.relation === "corroborates"),
    true,
  );
});

test("相反候補を一致候補より先に表示しconfidenceを中以下に制限する", () => {
  const primary = extraction(
    "電子コミック市場規模は2025年に100億円でした。",
    ["市場", "規模"],
    1,
    "primary.example",
  );
  const comparison = extraction(
    "電子コミック市場規模は2025年に120億円でした。\n電子コミック市場規模は2025年に100億円との資料もあります。",
    ["市場", "規模"],
    2,
    "comparison.example",
  );
  comparison.candidates = [
    {
      ...comparison.candidates[0],
      id: "conflict",
      text: "電子コミック市場規模は2025年に120億円でした。",
    },
    {
      ...comparison.candidates[0],
      id: "support",
      text: "電子コミック市場規模は2025年に100億円との資料もあります。",
    },
  ];
  const result = compareCloudResearchClaimCandidates(primary, comparison);
  assert.deepEqual(
    result.comparisons.map((item) => item.relation),
    ["potential_conflict", "corroborates"],
  );
  assert.equal(
    result.comparisons.every((item) =>
      ["low", "medium"].includes(item.confidence),
    ),
    true,
  );
});

test("照合Actionは認証・利用制限後に2出典を取得し全文を返さない", async () => {
  const [action, client, page] = await Promise.all([
    readFile(
      new URL(
        "../src/app/dashboard/research/new/corroboration-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/research/new/claim-comparison.tsx",
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
      actionBody.indexOf("Promise.all"),
  );
  assert.match(actionBody, /fetchCloudResearchSourceSnapshot\(parsed\.data\.primaryUrl\)/);
  assert.match(actionBody, /fetchCloudResearchSourceSnapshot\(parsed\.data\.comparisonUrl\)/);
  assert.doesNotMatch(actionBody, /text:\s*(primary|comparison)Snapshot\.text/);
  assert.match(client, /相反表示は誤りの断定ではなく/);
  assert.match(client, /両方を出典1・2へ採用/);
  assert.match(client, /sourceFact1/);
  assert.match(client, /出典2の種別/);
  assert.doesNotMatch(page, /<ClaimComparison/);
});
