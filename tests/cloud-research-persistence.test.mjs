import assert from "node:assert/strict";
import test from "node:test";
import {
  createCloudResearchReportWithPersistence,
  getCloudResearchReportWithPersistence,
  listCloudResearchReportsWithPersistence,
} from "../src/lib/cloud-research-persistence.ts";
import {
  parseCloudResearchForm,
  runCloudMarketAnalysis,
} from "../src/lib/cloud-research.ts";

const profileId = "10000000-0000-4000-8000-000000000001";
const reportId = "20000000-0000-4000-8000-000000000001";

function researchData() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    genre: "女性向けファンタジー",
    audience: "20代〜30代のWeb漫画読者",
    platform: "電子書籍ストア",
    contentClass: "general",
    theme: "再出発と仕事",
    referenceWorks: "参考作品A",
    priceMin: "300",
    priceMax: "800",
    publicationFormat: "one_shot",
    pageCount: "48",
    sourceTitle0: "公式ランキング",
    sourceUrl0: "https://example.com/ranking",
    sourceRetrievedAt0: "2026-07-29T09:00",
    sourceFact0: "公式特集に掲載されている。",
    sourceType0: "platform",
    sourceTopics0: "demand",
  })) {
    form.set(key, value);
  }
  const input = parseCloudResearchForm(form);
  const result = runCloudMarketAnalysis(
    input,
    "2026-07-29T00:00:00.000Z",
  );
  return { input, result };
}

function report() {
  const { input, result } = researchData();
  return {
    id: reportId,
    owner_profile_id: profileId,
    status: "completed",
    input,
    sources: input.evidence,
    result,
    engine_version: result.engineVersion,
    completed_at: result.generatedAt,
    created_at: "2026-07-29T00:00:01.000Z",
  };
}

function persistence({
  insertData = { id: reportId },
  insertError = null,
  listData = [report()],
  listError = null,
  findData = report(),
  findError = null,
} = {}) {
  const calls = { inserted: [], listed: [], found: [] };
  return {
    calls,
    adapter: {
      async insert(value) {
        calls.inserted.push(value);
        return { data: insertData, error: insertError };
      },
      async list(ownerId) {
        calls.listed.push(ownerId);
        return { data: listData, error: listError };
      },
      async find(ownerId, id) {
        calls.found.push({ ownerId, id });
        return { data: findData, error: findError };
      },
    },
  };
}

test("市場分析保存はServerが所有者・出典・完了状態を設定する", async () => {
  const { input, result } = researchData();
  const { adapter, calls } = persistence();
  assert.equal(
    await createCloudResearchReportWithPersistence({
      profileId,
      input,
      result,
      persistence: adapter,
    }),
    reportId,
  );
  assert.equal(calls.inserted[0].owner_profile_id, profileId);
  assert.equal(calls.inserted[0].status, "completed");
  assert.deepEqual(calls.inserted[0].sources, input.evidence);
});

test("市場分析一覧と詳細は現在Profileだけを永続化層へ渡す", async () => {
  const { adapter, calls } = persistence();
  const reports = await listCloudResearchReportsWithPersistence({
    profileId,
    persistence: adapter,
  });
  const found = await getCloudResearchReportWithPersistence({
    profileId,
    reportId,
    persistence: adapter,
  });
  assert.equal(reports.length, 1);
  assert.equal(found.id, reportId);
  assert.deepEqual(calls.listed, [profileId]);
  assert.deepEqual(calls.found, [{ ownerId: profileId, id: reportId }]);
});

test("別ProfileのReportは所有者限定検索で未検出になる", async () => {
  const otherProfileId = "10000000-0000-4000-8000-000000000002";
  const scoped = persistence({ findData: null });
  await assert.rejects(
    getCloudResearchReportWithPersistence({
      profileId: otherProfileId,
      reportId,
      persistence: scoped.adapter,
    }),
    (error) => error.code === "RESOURCE_NOT_FOUND",
  );
  assert.deepEqual(scoped.calls.found, [
    { ownerId: otherProfileId, id: reportId },
  ]);
});

test("不正Report IDはDB照会せず未検出として扱う", async () => {
  const { adapter, calls } = persistence();
  await assert.rejects(
    getCloudResearchReportWithPersistence({
      profileId,
      reportId: "not-a-uuid",
      persistence: adapter,
    }),
    (error) => error.code === "RESOURCE_NOT_FOUND",
  );
  assert.equal(calls.found.length, 0);
});

test("保存・一覧・詳細のDB失敗は内部詳細を公開しない", async () => {
  const databaseError = new Error("private database detail");
  const { input, result } = researchData();

  await assert.rejects(
    createCloudResearchReportWithPersistence({
      profileId,
      input,
      result,
      persistence: persistence({
        insertData: null,
        insertError: databaseError,
      }).adapter,
    }),
    (error) =>
      error.code === "INTERNAL_ERROR" &&
      !error.message.includes(databaseError.message),
  );
  await assert.rejects(
    listCloudResearchReportsWithPersistence({
      profileId,
      persistence: persistence({
        listData: null,
        listError: databaseError,
      }).adapter,
    }),
    (error) =>
      error.code === "INTERNAL_ERROR" &&
      !error.message.includes(databaseError.message),
  );
  await assert.rejects(
    getCloudResearchReportWithPersistence({
      profileId,
      reportId,
      persistence: persistence({
        findData: null,
        findError: databaseError,
      }).adapter,
    }),
    (error) =>
      error.code === "INTERNAL_ERROR" &&
      !error.message.includes(databaseError.message),
  );
});

test("存在しないReportはRESOURCE_NOT_FOUNDを返す", async () => {
  await assert.rejects(
    getCloudResearchReportWithPersistence({
      profileId,
      reportId,
      persistence: persistence({ findData: null }).adapter,
    }),
    (error) => error.code === "RESOURCE_NOT_FOUND",
  );
});
