import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildCloudReleaseCheckpointGuidance,
  findNextCloudReleaseCheckpointPage,
} from "../src/lib/cloud-release-checkpoint-guidance.ts";

test("完成条件を取得できない場合は固定をfail closedにする", () => {
  assert.deepEqual(buildCloudReleaseCheckpointGuidance(null), {
    available: false,
    blockers: [],
    errorCount: 0,
    nextPages: [],
    pageStatuses: [],
    remainingPageCount: 0,
    ready: false,
    summary: "完成条件を確認できないため、完成版を固定できません。",
  });
});

test("完成版固定の主要な阻害理由を件数で案内する", () => {
  const guidance = buildCloudReleaseCheckpointGuidance(
    {
      errorCount: 9,
      issueCountByCode: {
        empty_panel: 4,
        generation_active: 1,
        page_not_finalized: 2,
        page_stale: 2,
      },
      pageCountByProductionStatus: {
        not_started: 24,
        review_required: 7,
        revision_required: 1,
      },
      ready: false,
    },
    [
      {
        isStale: false,
        pageId: "page-1",
        pageNumber: 1,
        status: "not_started",
      },
      {
        isStale: false,
        pageId: "page-8",
        pageNumber: 8,
        status: "review_required",
      },
      {
        isStale: false,
        pageId: "page-12",
        pageNumber: 12,
        status: "revision_required",
      },
      { isStale: true, pageId: "page-20", pageNumber: 20, status: "finalized" },
      {
        isStale: false,
        pageId: "page-32",
        pageNumber: 32,
        status: "finalized",
      },
    ],
  );

  assert.equal(guidance.available, true);
  assert.equal(guidance.ready, false);
  assert.match(guidance.summary, /確定済み0\/32ページ/);
  assert.match(guidance.summary, /要修正9件/);
  assert.deepEqual(
    guidance.pageStatuses.map(({ status, count }) => ({ status, count })),
    [
      { status: "not_started", count: 24 },
      { status: "review_required", count: 7 },
      { status: "revision_required", count: 1 },
    ],
  );
  assert.deepEqual(
    guidance.blockers.map(({ code, count }) => ({ code, count })),
    [
      { code: "empty_panel", count: 4 },
      { code: "generation_active", count: 1 },
      { code: "page_not_finalized", count: 2 },
      { code: "page_stale", count: 2 },
    ],
  );
  assert.deepEqual(
    guidance.nextPages.map(({ pageNumber, statusLabel }) => ({
      pageNumber,
      statusLabel,
    })),
    [
      { pageNumber: 20, statusLabel: "設定変更後の再確認" },
      { pageNumber: 12, statusLabel: "修正して再確認" },
      { pageNumber: 8, statusLabel: "確認して確定" },
      { pageNumber: 1, statusLabel: "制作を開始" },
    ],
  );
  assert.equal(guidance.remainingPageCount, 0);
});

test("原稿チェック合格時だけ完成版固定を許可する", () => {
  const guidance = buildCloudReleaseCheckpointGuidance({
    errorCount: 0,
    issueCountByCode: {},
    pageCountByProductionStatus: { finalized: 8 },
    ready: true,
  });

  assert.equal(guidance.ready, true);
  assert.equal(guidance.blockers.length, 0);
  assert.deepEqual(guidance.nextPages, []);
  assert.equal(guidance.remainingPageCount, 0);
  assert.deepEqual(guidance.pageStatuses, [
    { count: 8, label: "確定済み", status: "finalized" },
  ]);
  assert.match(guidance.summary, /完成版を固定できます/);
});

test("作品画面は詳細案内を完成版固定buttonへ接続する", async () => {
  const [page, panel] = await Promise.all([
    readFile("src/app/creator/[projectId]/page.tsx", "utf8"),
    readFile("src/app/creator/[projectId]/ProjectCheckpointPanel.tsx", "utf8"),
  ]);

  assert.match(page, /buildCloudReleaseCheckpointGuidance\(\s*exportReadiness/);
  assert.match(page, /resolvedReleaseGuidancePages\.length === pages\.length/);
  assert.match(page, /releaseGuidance=\{releaseGuidance\}/);
  assert.match(panel, /disabled=\{!releaseGuidance\.ready\}/);
  assert.match(panel, /release-checkpoint-readiness/);
  assert.match(panel, /次に確認するページ/);
  assert.match(panel, /releaseGuidance\.nextPages/);
  assert.match(panel, /原稿チェックと修正先を確認/);
  assert.match(panel, /id="project-checkpoints"/);
});

test("未完了ページは5件まで表示し残数を案内する", () => {
  const guidance = buildCloudReleaseCheckpointGuidance(
    {
      errorCount: 7,
      issueCountByCode: { page_not_finalized: 7 },
      pageCountByProductionStatus: { not_started: 7 },
      ready: false,
    },
    Array.from({ length: 7 }, (_, index) => ({
      isStale: false,
      pageId: `page-${index + 1}`,
      pageNumber: index + 1,
      status: "not_started",
    })),
  );

  assert.deepEqual(
    guidance.nextPages.map((page) => page.pageNumber),
    [1, 2, 3, 4, 5],
  );
  assert.equal(guidance.remainingPageCount, 2);
});

test("確定後は現在ページを除き優先度が最も高いページへ進む", () => {
  assert.deepEqual(
    findNextCloudReleaseCheckpointPage(
      [
        { isStale: false, pageId: "current", pageNumber: 1, status: "revision_required" },
        { isStale: false, pageId: "page-2", pageNumber: 2, status: "not_started" },
        { isStale: false, pageId: "page-3", pageNumber: 3, status: "review_required" },
        { isStale: true, pageId: "page-4", pageNumber: 4, status: "finalized" },
      ],
      "current",
    ),
    { isStale: true, pageId: "page-4", pageNumber: 4, status: "finalized" },
  );
  assert.equal(
    findNextCloudReleaseCheckpointPage(
      [{ isStale: false, pageId: "current", pageNumber: 1, status: "finalized" }],
      "current",
    ),
    null,
  );
});
